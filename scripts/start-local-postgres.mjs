import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDir, "..");
const dataDir = path.join(projectRoot, ".local", "postgres-data");
const databaseName = "cc_store";
const databaseUser = "postgres";
const targetTimeZone = "Asia/Kolkata";

const postgres = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: databaseUser,
  password: "postgres",
  port: 55432,
  persistent: true,
  onLog: (message) => {
    if (process.env.DB_VERBOSE === "1") {
      console.log(message);
    }
  },
  onError: (error) => {
    console.error(error);
  },
});

async function ensureDatabase() {
  try {
    await postgres.createDatabase(databaseName);
    console.log(`[local-db] Database '${databaseName}' created.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes("already exists") ||
      message.includes("duplicate key") ||
      message.includes("42P04")
    ) {
      console.log(`[local-db] Database '${databaseName}' already exists.`);
      return;
    }
    throw error;
  }
}

async function needsInitialization() {
  try {
    await fs.access(path.join(dataDir, "PG_VERSION"));
    return false;
  } catch {
    return true;
  }
}

async function ensureTimeZone() {
  const adminClient = postgres.getPgClient("postgres");
  await adminClient.connect();

  try {
    await adminClient.query(`ALTER DATABASE "${databaseName}" SET timezone TO '${targetTimeZone}'`);
    await adminClient.query(
      `ALTER ROLE "${databaseUser}" IN DATABASE "${databaseName}" SET timezone TO '${targetTimeZone}'`,
    );
    console.log(`[local-db] Default timezone set to ${targetTimeZone}.`);
  } finally {
    await adminClient.end();
  }

  const appClient = postgres.getPgClient(databaseName);
  await appClient.connect();

  try {
    const result = await appClient.query("SHOW TIME ZONE");
    const row = result.rows[0] ?? {};
    const activeTimeZone = row.TimeZone ?? row.timezone ?? Object.values(row)[0];
    console.log(`[local-db] Active session timezone: ${activeTimeZone}`);
  } finally {
    await appClient.end();
  }
}

async function shutdown() {
  try {
    await postgres.stop();
    console.log("[local-db] Stopped.");
  } catch (error) {
    console.error("[local-db] Failed to stop cleanly:", error);
  } finally {
    process.exit(0);
  }
}

async function main() {
  await fs.mkdir(path.join(projectRoot, ".local"), { recursive: true });
  await fs.mkdir(dataDir, { recursive: true });

  if (await needsInitialization()) {
    await postgres.initialise();
  } else {
    console.log("[local-db] Reusing existing postgres data directory.");
  }

  await postgres.start();
  await ensureDatabase();
  await ensureTimeZone();

  console.log(`[local-db] Running on postgresql://postgres:postgres@127.0.0.1:55432/${databaseName}?schema=public`);

  process.on("SIGINT", () => {
    void shutdown();
  });

  process.on("SIGTERM", () => {
    void shutdown();
  });

  process.stdin.resume();
}

main().catch((error) => {
  console.error("[local-db] Fatal error:", error);
  process.exit(1);
});
