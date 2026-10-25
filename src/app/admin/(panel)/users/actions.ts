"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { audit, requireAdmin } from "@/lib/admin";
import { deleteAccount } from "@/lib/account";

const fields = (formData: FormData) => Object.fromEntries(formData.entries());

export async function lockAction(formData: FormData) {
  const admin = await requireAdmin("users");
  const { userId, reason } = z.object({ userId: z.uuid(), reason: z.string().trim().min(3).max(300) }).parse(fields(formData));
  await db.update(schema.users).set({ lockedAt: new Date(), lockReason: reason }).where(eq(schema.users.id, userId));
  await db.update(schema.deviceSessions).set({ revokedAt: sql`now()` }).where(and(eq(schema.deviceSessions.userId, userId), isNull(schema.deviceSessions.revokedAt)));
  await audit(admin.id, "user.locked", "user", userId, { reason });
  revalidatePath(`/admin/users/${userId}`);
  return { message: "Konto gesperrt und auf allen Geräten abgemeldet." };
}

export async function unlockAction(formData: FormData) {
  const admin = await requireAdmin("users");
  const userId = z.uuid().parse(formData.get("userId"));
  await db.update(schema.users).set({ lockedAt: null, lockReason: null }).where(eq(schema.users.id, userId));
  await audit(admin.id, "user.unlocked", "user", userId);
  revalidatePath(`/admin/users/${userId}`);
  return { message: "Konto entsperrt." };
}

export async function revokeSessionsAction(formData: FormData) {
  const admin = await requireAdmin("users");
  const userId = z.uuid().parse(formData.get("userId"));
  await db.update(schema.deviceSessions).set({ revokedAt: sql`now()` }).where(and(eq(schema.deviceSessions.userId, userId), isNull(schema.deviceSessions.revokedAt)));
  await audit(admin.id, "user.sessions_revoked", "user", userId);
  revalidatePath(`/admin/users/${userId}`);
  return { message: "Auf allen Geräten abgemeldet." };
}

export async function revokeSessionAction(formData: FormData) {
  const admin = await requireAdmin("users");
  const { userId, sessionId } = z.object({ userId: z.uuid(), sessionId: z.uuid() }).parse(fields(formData));
  await db.update(schema.deviceSessions).set({ revokedAt: sql`now()` }).where(and(eq(schema.deviceSessions.id, sessionId), eq(schema.deviceSessions.userId, userId)));
  await audit(admin.id, "user.sessions_revoked", "user", userId, { sessionId });
  revalidatePath(`/admin/users/${userId}`);
  return { message: "Gerät abgemeldet." };
}

/** Plus as a goodwill gesture for a set time. Paid subscriptions are only changed by the App Store. */
export async function grantPlusAction(formData: FormData) {
  const admin = await requireAdmin("users");
  const { userId, days } = z.object({ userId: z.uuid(), days: z.coerce.number().int().min(0).max(366) }).parse(fields(formData));
  const [subscription] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, userId));
  if (subscription) return { error: "Das Konto hat ein App-Store-Abo; das verwaltet Apple." };
  const until = days ? new Date(Date.now() + days * 86400_000) : null;
  await db.update(schema.users).set({ plan: days ? "plus" : "free", planExpiresAt: until }).where(eq(schema.users.id, userId));
  await audit(admin.id, "user.plan", "user", userId, { plan: days ? "plus" : "free", days });
  revalidatePath(`/admin/users/${userId}`);
  return { message: days ? `Plus für ${days} Tage gewährt.` : "Zurück auf Free gesetzt." };
}

/** Deletion on request through support, same as in the app (PRV-04). */
export async function deleteUserAction(formData: FormData) {
  const admin = await requireAdmin("users");
  const { userId, confirm } = z.object({ userId: z.uuid(), confirm: z.string() }).parse(fields(formData));
  if (confirm.trim().toUpperCase() !== "LÖSCHEN") return { error: "Zum Bestätigen genau „LÖSCHEN“ eingeben." };
  const { appleRevoked } = await deleteAccount(userId);
  await audit(admin.id, "user.deleted", "user", userId, { appleRevoked, via: "support" });
  revalidatePath("/admin/users");
  redirect("/admin/users?deleted=1");
}
