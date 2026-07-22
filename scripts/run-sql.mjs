// Run an arbitrary .sql file against the project via the Management API.
// Usage: node scripts/run-sql.mjs path/to/file.sql
import { readFileSync } from "node:fs";

const projectRef = process.env.SUPABASE_PROJECT_REF;
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
const file = process.argv[2];

if (!projectRef || !accessToken || !file) {
  console.error("Usage: SUPABASE_PROJECT_REF=... SUPABASE_ACCESS_TOKEN=... node scripts/run-sql.mjs <file.sql>");
  process.exit(1);
}

const sql = readFileSync(file, "utf8");
const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ query: sql }),
});
const text = await res.text();
console.log(res.status, text);
if (!res.ok) process.exit(1);
