import { createHash } from "node:crypto";
import { z } from "zod";
import { db, schema } from "@/db";
import { body, ok, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { latestConsents } from "@/lib/account";

const input = z.object({
  kind: z.enum(["healthData", "aiProcessing", "appleHealth", "notifications", "community", "healthSync"]),
  granted: z.boolean(),
  version: z.string().max(20),
  text: z.string().max(5000).optional(),
});

export const GET = route(async (request) => {
  const { user } = await requireUser(request);
  return ok({ consents: await latestConsents(user.id) });
});

/** Each consent is stored with version, time and a hash of the exact text shown (PRV-01). */
export const POST = route(async (request) => {
  const { user } = await requireUser(request);
  const consent = await body(request, input);
  const [saved] = await db
    .insert(schema.consents)
    .values({ userId: user.id, kind: consent.kind, granted: consent.granted, version: consent.version, textHash: consent.text ? createHash("sha256").update(consent.text).digest("hex") : null })
    .returning();
  return ok(saved, 201);
});
