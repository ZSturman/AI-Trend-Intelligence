import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const prismaDir = join(rootDir, "prisma");
const schemaPath = join(prismaDir, "schema.prisma");
const sqlPath = join(prismaDir, "init.sql");
const dbPath = join(prismaDir, "dev.db");

mkdirSync(prismaDir, { recursive: true });
rmSync(dbPath, { force: true });

const sql = execFileSync(
  "npx",
  ["prisma", "migrate", "diff", "--from-empty", "--to-schema-datamodel", schemaPath, "--script"],
  {
    cwd: rootDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  },
);

writeFileSync(sqlPath, sql, "utf8");
execFileSync("sqlite3", [dbPath], {
  cwd: rootDir,
  input: `.read ${sqlPath}\n`,
  stdio: "inherit",
});

console.log(`Database initialized at ${dbPath}`);
