import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { adminClient } from "./supabase.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const MIGRATION_FILES = [
  "init.sql",
  "migrate-add-rls.sql",
];

async function migrate() {
  for (const file of MIGRATION_FILES) {
    const filePath = join(__dirname, file);
    if (!existsSync(filePath)) {
      console.log(`Skipping ${file} (not found)`);
      continue;
    }
    console.log(`Running ${file}...`);
    const sql = readFileSync(filePath, "utf8");
    const { error } = await adminClient.rpc("exec_sql", { query: sql });
    if (error) throw new Error(`${file} failed: ${error.message}`);
    console.log(`  ${file} complete.`);
  }
  console.log("All migrations complete.");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
