import { z } from "zod";
import { db, schema } from "@/db";
import { body, ok, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";

const input = z.object({
  displayName: z.string().max(80).nullable().optional(),
  birthYear: z.number().int().min(1900).max(new Date().getFullYear() - 18).nullable().optional(),
  sexForCalc: z.enum(["female", "male"]).nullable().optional(),
  bodyType: z.enum(["female", "male", "neutral"]).optional(),
  heightCm: z.number().min(100).max(250).nullable().optional(),
  activityLevel: z.enum(["sedentary", "light", "moderate", "active", "veryActive"]).nullable().optional(),
  dietType: z.enum(["omnivore", "flexitarian", "pescatarian", "vegetarian", "vegan"]).nullable().optional(),
  allergens: z.array(z.enum(["gluten", "lactose", "nuts", "peanuts", "eggs", "soy", "fish", "shellfish", "sesame"])).optional(),
  units: z.enum(["metric", "imperial"]).optional(),
  locale: z.enum(["en", "de", "de-CH", "fr", "it", "es"]).optional(),
  protectionMode: z.boolean().optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

/** Partial update; fields left out stay as they are. Minimum age 18 is enforced via birth year. */
export const PATCH = route(async (request) => {
  const { user } = await requireUser(request);
  const changes = await body(request, input);
  const [profile] = await db
    .insert(schema.profiles)
    .values({ userId: user.id, ...changes })
    .onConflictDoUpdate({ target: schema.profiles.userId, set: { ...changes, updatedAt: new Date() } })
    .returning();
  return ok(profile);
});
