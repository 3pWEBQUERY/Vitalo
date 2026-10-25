import { z } from "zod";
import { ok, query, rateLimit, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { foodDTO, searchFoods } from "@/lib/foods";

export const GET = route(async (request) => {
  const { user } = await requireUser(request);
  rateLimit(`search:${user.id}`, 120, 60_000);
  const { q, limit } = query(request, z.object({ q: z.string().max(80), limit: z.coerce.number().int().min(1).max(50).default(25) }));
  return ok({ foods: (await searchFoods(q, user.id, limit)).map(foodDTO) });
});
