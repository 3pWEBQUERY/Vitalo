// Applies versioned SQL migrations in order, once each.
import { readdir, readFile } from "node:fs/promises";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL ?? "postgres://localhost:5432/vitalo", { onnotice: () => {} });
await sql`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`;
const applied = new Set((await sql`select name from schema_migrations`).map((row) => row.name));
const files = (await readdir(new URL("../migrations", import.meta.url))).filter((f) => f.endsWith(".sql")).sort();
for (const file of files) {
  if (applied.has(file)) continue;
  const body = await readFile(new URL(`../migrations/${file}`, import.meta.url), "utf8");
  await sql.begin(async (tx) => {
    await tx.unsafe(body);
    await tx`insert into schema_migrations (name) values (${file})`;
  });
  console.log(`applied ${file}`);
}
await sql.end();
