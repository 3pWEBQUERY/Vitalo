import { z } from "zod";
import { body, ok, rateLimit, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { confirmFood } from "@/lib/foods";

const input = z.object({
  kcal: z.number().min(0).max(950),
  protein: z.number().min(0).max(100).nullable().optional(),
  carbs: z.number().min(0).max(100).nullable().optional(),
  fat: z.number().min(0).max(100).nullable().optional(),
});

/** Confirms the values on the pack, or proposes a correction when they differ (DB-06). */
export const POST = route(async (request, context: { params: Promise<{ id: string }> }) => {
  const { user } = await requireUser(request);
  rateLimit(`confirm:${user.id}`, 60, 60 * 60_000);
  const { id } = await context.params;
  return ok(await confirmFood(user.id, z.uuid().parse(id), await body(request, input)));
});
