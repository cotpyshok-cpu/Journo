import { existsSync, copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const envPath = path.join(root, ".env");
const envExamplePath = path.join(root, ".env.example");
const schemaPath = path.join(root, "prisma", "schema.prisma");
const pgSchemaPath = path.join(root, "prisma", "schema.postgres.prisma");

if (!existsSync(envPath) && existsSync(envExamplePath)) {
  copyFileSync(envExamplePath, envPath);
  console.log("[Journo DB] Created .env from .env.example");
}

function readDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.POSTGRES_PRISMA_URL) {
    process.env.DATABASE_URL = process.env.POSTGRES_PRISMA_URL;
    return process.env.POSTGRES_PRISMA_URL;
  }
  if (process.env.POSTGRES_URL) {
    process.env.DATABASE_URL = process.env.POSTGRES_URL;
    return process.env.POSTGRES_URL;
  }
  if (!existsSync(envPath)) return "file:./dev.db";
  const content = readFileSync(envPath, "utf-8");
  const match = content.match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m);
  return match ? match[1].trim() : "file:./dev.db";
}

const dbUrl = readDatabaseUrl();
const isPostgres = dbUrl.startsWith("postgres://") || dbUrl.startsWith("postgresql://");

let targetSchema = schemaPath;
if (isPostgres && existsSync(pgSchemaPath)) {
  console.log("[Journo DB] PostgreSQL DATABASE_URL detected. Syncing postgres schema...");
  const pgContent = readFileSync(pgSchemaPath, "utf-8");
  writeFileSync(schemaPath, pgContent, "utf-8");
} else {
  console.log(`[Journo DB] SQLite database mode (${dbUrl})`);
}

const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";

try {
  execSync(`${npxCmd} prisma generate --schema="${targetSchema}"`, {
    stdio: "inherit",
    cwd: root,
  });
  execSync(`${npxCmd} prisma db push --skip-generate --schema="${targetSchema}"`, {
    stdio: "inherit",
    cwd: root,
  });
  console.log("[Journo DB] Schema generated and pushed successfully.");
} catch (err) {
  console.error("[Journo DB] Warning during setup:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
}
