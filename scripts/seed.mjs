// Loads the reference foods (same set the app ships with) as verified entries. Safe to re-run:
// existing rows only gain missing translations, so edits made in the admin are kept.
import { readFile } from "node:fs/promises";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL ?? "postgres://localhost:5432/vitalo", { onnotice: () => {} });
const foods = JSON.parse(await readFile(new URL("../seed/foods.json", import.meta.url), "utf8"));
let added = 0;
for (const food of foods) {
  const names = { ...food.names };
  const result = await sql`
    insert into foods (source, source_ref, name, names, kcal_100, protein_100, carbs_100, fat_100, fiber_100, sugar_100, salt_100, servings, serving_g, quality, nutrients)
    values ('usda', ${food.key}, ${food.names.de ?? food.names.en}, ${sql.json(names)}, ${food.kcal}, ${food.protein}, ${food.carbs}, ${food.fat},
            ${food.fiber}, ${food.sugar}, ${food.salt}, ${sql.json(food.servings)}, ${food.servings[0]?.grams ?? null}, 'verified', ${sql.json({ category: food.category })})
    on conflict (source, source_ref) where source in ('usda', 'blv') do update set names = excluded.names || foods.names
    returning (xmax = 0) as inserted`;
  if (result[0]?.inserted) added++;
}
console.log(`seeded ${added} reference foods`);
await sql.end();
