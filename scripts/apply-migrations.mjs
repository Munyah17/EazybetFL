// One-off migration runner: applies supabase/migrations/*.sql in order
// against the live project via the Supabase Management API (no DB
// password available in this environment, only the PAT).
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "..", "supabase", "migrations");
const projectRef = process.env.SUPABASE_PROJECT_REF;
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

if (!projectRef || !accessToken) {
  console.error("Missing SUPABASE_PROJECT_REF or SUPABASE_ACCESS_TOKEN env vars");
  process.exit(1);
}

const only = process.argv[2]; // optional filename filter

const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .filter((f) => !only || f.includes(only))
  .sort();

for (const file of files) {
  const sql = readFileSync(join(migrationsDir, file), "utf8");
  process.stdout.write(`Applying ${file} ... `);
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    }
  );
  const text = await res.text();
  if (!res.ok) {
    console.log("FAILED");
    console.error(text);
    process.exit(1);
  }
  console.log("ok");
}

console.log("All migrations applied.");
