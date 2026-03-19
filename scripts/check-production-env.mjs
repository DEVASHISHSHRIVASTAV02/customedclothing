#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const REQUIRED_KEYS = [
  "DATABASE_URL",
  "NEXTAUTH_URL",
  "NEXTAUTH_SECRET",
  "ADMIN_EMAIL",
  "ADMIN_PASSWORD",
  "PUBLIC_STORAGE_BASE_URL",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "INTERNAL_NOTIFY_SECRET",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "CONTACT_TO_EMAIL",
  "MSG91_AUTH_KEY",
  "MSG91_SMS_TEMPLATE_ID",
  "MSG91_WHATSAPP_INTEGRATED_NUMBER",
  "MSG91_WHATSAPP_TEMPLATE_NAME",
];

function parseEnvFile(content) {
  const result = new Map();

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separator = line.indexOf("=");
    if (separator <= 0) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result.set(key, value);
  }

  return result;
}

function main() {
  const targetPath = process.argv[2] || ".env.production.local";
  const absolutePath = path.resolve(process.cwd(), targetPath);

  if (!fs.existsSync(absolutePath)) {
    console.error(`Env file not found: ${absolutePath}`);
    process.exit(2);
  }

  const parsed = parseEnvFile(fs.readFileSync(absolutePath, "utf8"));

  const missing = [];
  const empty = [];
  for (const key of REQUIRED_KEYS) {
    if (!parsed.has(key)) {
      missing.push(key);
      continue;
    }

    const value = parsed.get(key);
    if (!value) {
      empty.push(key);
    }
  }

  const checkedCount = REQUIRED_KEYS.length;
  console.log(`Checked ${checkedCount} required keys in ${targetPath}.`);

  if (missing.length === 0 && empty.length === 0) {
    console.log("OK: no missing/empty required keys.");
    return;
  }

  if (missing.length > 0) {
    console.log("");
    console.log("Missing keys:");
    for (const key of missing) {
      console.log(`- ${key}`);
    }
  }

  if (empty.length > 0) {
    console.log("");
    console.log("Empty keys:");
    for (const key of empty) {
      console.log(`- ${key}`);
    }
  }

  process.exit(1);
}

main();
