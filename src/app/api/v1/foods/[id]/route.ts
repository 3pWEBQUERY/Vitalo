import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { notFound, ok, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { foodDTO } from "@/lib/foods";

export const GET = route(async (request, context: { params: Promise<{ id: string }> }) => {
  const { user } = await requireUser(request);
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw notFound();
  const [food] = await db.select().from(schema.foods).where(eq(schema.foods.id, id)).limit(1);
  if (!food || (food.isPrivate && food.createdBy !== user.id)) throw notFound();
  return ok(foodDTO(food));
});
