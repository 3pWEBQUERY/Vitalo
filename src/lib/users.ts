import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { User } from "@/db/schema";

/** Finds the account for an Apple ID or creates it with an empty profile. */
export async function findOrCreateUser(appleSub: string, email?: string, displayName?: string): Promise<{ user: User; isNew: boolean }> {
  const [existing] = await db.select().from(schema.users).where(eq(schema.users.appleSub, appleSub)).limit(1);
  if (existing && !existing.deletedAt) return { user: existing, isNew: false };
  const [user] = await db.insert(schema.users).values({ appleSub, email: email ?? null }).returning();
  await db.insert(schema.profiles).values({ userId: user.id, displayName: displayName ?? null }).onConflictDoNothing();
  return { user, isNew: true };
}

/** Account bound to this iPhone's Keychain secret; created on first use. */
export async function findOrCreateDeviceUser(secretHash: string): Promise<{ user: User; isNew: boolean }> {
  const [existing] = await db.select().from(schema.users).where(eq(schema.users.deviceSecretHash, secretHash)).limit(1);
  if (existing && !existing.deletedAt) return { user: existing, isNew: false };
  const [user] = await db.insert(schema.users).values({ deviceSecretHash: secretHash }).returning();
  await db.insert(schema.profiles).values({ userId: user.id }).onConflictDoNothing();
  return { user, isNew: true };
}
