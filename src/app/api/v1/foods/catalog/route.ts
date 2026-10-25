import { and, asc, eq, gt, isNotNull, or } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { ok, query, route } from "@/lib/api";
import { foodDTO } from "@/lib/foods";

/**
 * Changes to the shared reference foods (the ones the app ships with, matched by `sourceRef`)
 * and to editorial entries since the cursor: corrected values, translations and product photos.
 */
export const GET = route(async (request) => {
  const { since } = query(request, z.object({ since: z.iso.datetime({ offset: true }).optional() }));
  const rows = await db
    .select()
    .from(schema.foods)
    .where(
      and(
        eq(schema.foods.isPrivate, false),
        or(isNotNull(schema.foods.sourceRef), eq(schema.foods.source, "editorial")),
        since ? gt(schema.foods.updatedAt, new Date(since)) : undefined,
      ),
    )
    .orderBy(asc(schema.foods.updatedAt))
    .limit(1000);
  return ok({
    foods: rows.map((food) => ({ ...foodDTO(food), updatedAt: food.updatedAt.toISOString() })),
    cursor: rows.length ? rows[rows.length - 1].updatedAt.toISOString() : since ?? null,
  });
});
