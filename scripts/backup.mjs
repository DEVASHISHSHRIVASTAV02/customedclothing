#!/usr/bin/env node
import { createWriteStream } from "fs";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { createGzip } from "zlib";
import { spawn } from "child_process";
import { PrismaClient } from "@prisma/client";

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
    // Missing .env is acceptable when values are already in process env.
  }
}

function formatTimestampForFilename(date) {
  return date.toISOString().replace(/:/g, "-").replace(/\..+$/, "Z");
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
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

async function cleanupOldFiles(directoryPath, retentionDays) {
  const maxAgeMs = retentionDays * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - maxAgeMs;

  let entries;
  try {
    entries = await fs.readdir(directoryPath, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const absolutePath = path.join(directoryPath, entry.name);
    const stat = await fs.stat(absolutePath);
    if (stat.mtimeMs < cutoff) {
      await fs.unlink(absolutePath);
    }
  }
}

async function collectDatabaseSnapshot(prisma) {
  const [
    adminUsers,
    customerUsers,
    passwordResetOtps,
    productTypes,
    productVariants,
    printAreas,
    shopConfigs,
    designDrafts,
    uploadedAssets,
    orders,
    orderItems,
    orderStatusLogs,
    notificationLogs,
  ] = await Promise.all([
    prisma.adminUser.findMany({ orderBy: { id: "asc" } }),
    prisma.customerUser.findMany({ orderBy: { id: "asc" } }),
    prisma.passwordResetOtp.findMany({ orderBy: { id: "asc" } }),
    prisma.productType.findMany({ orderBy: { id: "asc" } }),
    prisma.productVariant.findMany({ orderBy: { id: "asc" } }),
    prisma.printArea.findMany({ orderBy: { id: "asc" } }),
    prisma.shopConfig.findMany({ orderBy: { id: "asc" } }),
    prisma.designDraft.findMany({ orderBy: { id: "asc" } }),
    prisma.uploadedAsset.findMany({ orderBy: { id: "asc" } }),
    prisma.order.findMany({ orderBy: { id: "asc" } }),
    prisma.orderItem.findMany({ orderBy: { id: "asc" } }),
    prisma.orderStatusLog.findMany({ orderBy: { id: "asc" } }),
    prisma.notificationLog.findMany({ orderBy: { id: "asc" } }),
  ]);

  return {
    adminUsers,
    customerUsers,
    passwordResetOtps,
    productTypes,
    productVariants,
    printAreas,
    shopConfigs,
    designDrafts,
    uploadedAssets,
    orders,
    orderItems,
    orderStatusLogs,
    notificationLogs,
  };
}

async function main() {
  await loadDotEnvFile(path.resolve(process.cwd(), ".env"));

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  const timestamp = new Date();
  const dateTag = formatTimestampForFilename(timestamp);
  const backupRoot = process.env.BACKUP_ROOT?.trim()
    ? path.resolve(process.env.BACKUP_ROOT)
    : path.resolve(process.cwd(), ".local", "backups");
  const dbDir = path.join(backupRoot, "db");
  const filesDir = path.join(backupRoot, "files");
  const dbBackupPath = path.join(dbDir, `${dateTag}.json.gz`);
  const filesBackupPath = path.join(filesDir, `${dateTag}.tar.gz`);
  const retentionDays = Number.parseInt(process.env.RETENTION_DAYS ?? "14", 10);

  const storageRoot = process.env.STORAGE_ROOT_PATH?.trim()
    ? path.resolve(process.env.STORAGE_ROOT_PATH)
    : path.resolve(process.cwd(), "storage");
  const orderStoragePath = process.env.ORDER_STORAGE_PATH?.trim()
    ? path.resolve(process.env.ORDER_STORAGE_PATH)
    : path.join(storageRoot, "orders");
  const savedDraftsStoragePath = process.env.SAVED_DRAFTS_STORAGE_PATH?.trim()
    ? path.resolve(process.env.SAVED_DRAFTS_STORAGE_PATH)
    : path.join(storageRoot, "saved drafts");

  await fs.mkdir(dbDir, { recursive: true });
  await fs.mkdir(filesDir, { recursive: true });

  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  let snapshot;
  try {
    snapshot = await collectDatabaseSnapshot(prisma);
  } finally {
    await prisma.$disconnect();
  }

  const payload = {
    meta: {
      generatedAt: timestamp.toISOString(),
      databaseUrlHost: new URL(databaseUrl).host,
      formatVersion: 1,
    },
    tables: snapshot,
  };

  await pipeline(
    Readable.from(JSON.stringify(payload)),
    createGzip({ level: 9 }),
    createWriteStream(dbBackupPath),
  );

  const stageDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "cc-backup-stage-"));
  const stageOrdersPath = path.join(stageDirectory, "orders");
  const stageSavedDraftsPath = path.join(stageDirectory, "saved drafts");

  try {
    if (await pathExists(orderStoragePath)) {
      await fs.cp(orderStoragePath, stageOrdersPath, { recursive: true });
    } else {
      await fs.mkdir(stageOrdersPath, { recursive: true });
    }

    if (await pathExists(savedDraftsStoragePath)) {
      await fs.cp(savedDraftsStoragePath, stageSavedDraftsPath, { recursive: true });
    } else {
      await fs.mkdir(stageSavedDraftsPath, { recursive: true });
    }

    await runCommand("tar", ["-czf", filesBackupPath, "-C", stageDirectory, "."]);
  } finally {
    await fs.rm(stageDirectory, { recursive: true, force: true });
  }

  const safeRetentionDays = Number.isFinite(retentionDays) && retentionDays > 0 ? retentionDays : 14;
  await cleanupOldFiles(dbDir, safeRetentionDays);
  await cleanupOldFiles(filesDir, safeRetentionDays);

  console.log(`DB_BACKUP_PATH=${dbBackupPath}`);
  console.log(`FILES_BACKUP_PATH=${filesBackupPath}`);
}

main().catch((error) => {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`[backup] Failed: ${detail}`);
  process.exit(1);
});
