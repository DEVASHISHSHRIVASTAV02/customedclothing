#!/usr/bin/env node
import { promises as fs } from "fs";
import path from "path";
import { createGunzip } from "zlib";
import { pipeline } from "stream/promises";
import { createWriteStream, createReadStream } from "fs";
import os from "os";
import { spawn } from "child_process";
import { PrismaClient } from "@prisma/client";

function parseArgs(argv) {
  const args = {
    dbBackupPath: "",
    filesBackupPath: "",
    databaseUrl: "",
    storageRoot: "",
    force: false,
  };

  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--database-url") {
      args.databaseUrl = argv[i + 1] ?? "";
      i += 1;
      continue;
    }

    if (token === "--storage-root") {
      args.storageRoot = argv[i + 1] ?? "";
      i += 1;
      continue;
    }

    if (token === "--force") {
      args.force = true;
      continue;
    }

    positional.push(token);
  }

  args.dbBackupPath = positional[0] ?? "";
  args.filesBackupPath = positional[1] ?? "";
  return args;
}

function parseDotEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const index = trimmed.indexOf("=");
  if (index < 1) {
    return null;
  }

  const key = trimmed.slice(0, index).trim();
  let value = trimmed.slice(index + 1).trim();

  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }

  return { key, value };
}

async function loadDotEnvFile(envPath) {
  try {
    const content = await fs.readFile(envPath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const parsed = parseDotEnvLine(line);
      if (!parsed) {
        continue;
      }

      if (!(parsed.key in process.env)) {
        process.env[parsed.key] = parsed.value;
      }
    }
  } catch {
    // Missing .env is acceptable when env vars are already injected.
  }
}

async function gunzipToTempFile(backupPath) {
  const tempFilePath = path.join(os.tmpdir(), `cc-restore-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  await pipeline(createReadStream(backupPath), createGunzip(), createWriteStream(tempFilePath));
  return tempFilePath;
}

async function runCommand(command, args, options = {}) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: false,
      ...options,
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} exited with code ${code}.`));
    });
  });
}

async function createManyIfAny(model, rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return;
  }

  await model.createMany({ data: rows });
}

async function restoreDatabase(prisma, tables) {
  await prisma.$transaction([
    prisma.notificationLog.deleteMany(),
    prisma.orderStatusLog.deleteMany(),
    prisma.orderItem.deleteMany(),
    prisma.order.deleteMany(),
    prisma.uploadedAsset.deleteMany(),
    prisma.designDraft.deleteMany(),
    prisma.passwordResetOtp.deleteMany(),
    prisma.customerUser.deleteMany(),
    prisma.adminUser.deleteMany(),
    prisma.printArea.deleteMany(),
    prisma.productVariant.deleteMany(),
    prisma.productType.deleteMany(),
    prisma.shopConfig.deleteMany(),
  ]);

  await createManyIfAny(prisma.productType, tables.productTypes);
  await createManyIfAny(prisma.productVariant, tables.productVariants);
  await createManyIfAny(prisma.printArea, tables.printAreas);
  await createManyIfAny(prisma.shopConfig, tables.shopConfigs);
  await createManyIfAny(prisma.adminUser, tables.adminUsers);
  await createManyIfAny(prisma.customerUser, tables.customerUsers);
  await createManyIfAny(prisma.passwordResetOtp, tables.passwordResetOtps);
  await createManyIfAny(prisma.designDraft, tables.designDrafts);
  await createManyIfAny(prisma.uploadedAsset, tables.uploadedAssets);
  await createManyIfAny(prisma.order, tables.orders);
  await createManyIfAny(prisma.orderItem, tables.orderItems);
  await createManyIfAny(prisma.orderStatusLog, tables.orderStatusLogs);
  await createManyIfAny(prisma.notificationLog, tables.notificationLogs);
}

function ensureBackupShape(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid DB backup payload.");
  }

  const tables = payload.tables;
  if (!tables || typeof tables !== "object") {
    throw new Error("Backup payload does not include table data.");
  }

  return tables;
}

async function main() {
  await loadDotEnvFile(path.resolve(process.cwd(), ".env"));

  const args = parseArgs(process.argv.slice(2));
  if (!args.dbBackupPath || !args.filesBackupPath) {
    console.error("Usage: node scripts/restore.mjs <db-backup.json.gz> <files-backup.tar.gz> [--database-url <url>] [--storage-root <path>] [--force]");
    process.exit(1);
  }

  if (!args.force) {
    throw new Error("Refusing to restore without --force.");
  }

  const databaseUrl = (args.databaseUrl || process.env.DATABASE_URL || "").trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for restore.");
  }

  const storageRoot = args.storageRoot?.trim()
    ? path.resolve(args.storageRoot)
    : process.env.STORAGE_ROOT_PATH?.trim()
      ? path.resolve(process.env.STORAGE_ROOT_PATH)
      : path.resolve(process.cwd(), "storage");

  const dbBackupPath = path.resolve(args.dbBackupPath);
  const filesBackupPath = path.resolve(args.filesBackupPath);

  const tempJsonPath = await gunzipToTempFile(dbBackupPath);
  let parsed;
  try {
    const raw = await fs.readFile(tempJsonPath, "utf8");
    parsed = JSON.parse(raw);
  } finally {
    await fs.rm(tempJsonPath, { force: true });
  }

  const tables = ensureBackupShape(parsed);
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    await restoreDatabase(prisma, tables);
  } finally {
    await prisma.$disconnect();
  }

  await fs.mkdir(storageRoot, { recursive: true });
  await runCommand("tar", ["-xzf", filesBackupPath, "-C", storageRoot]);

  const ordersPath = path.join(storageRoot, "orders");
  const savedDraftsPath = path.join(storageRoot, "saved drafts");
  await fs.mkdir(ordersPath, { recursive: true });
  await fs.mkdir(savedDraftsPath, { recursive: true });

  console.log(`RESTORE_DATABASE_URL_HOST=${new URL(databaseUrl).host}`);
  console.log(`RESTORE_STORAGE_ROOT=${storageRoot}`);
}

main().catch((error) => {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`[restore] Failed: ${detail}`);
  process.exit(1);
});
