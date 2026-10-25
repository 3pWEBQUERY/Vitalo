"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { audit, currentAdmin, hashPassword, matchTotp, newTotpSecret, openSecret, passwordProblem, requireAdmin, sealSecret, twoFactorRequired, verifyPassword } from "@/lib/admin";

export type AccountState = { error?: string; done?: string };

export async function changePasswordAction(_: AccountState, formData: FormData): Promise<AccountState> {
  const admin = await requireAdmin("account");
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  if (!(await verifyPassword(current, admin.passwordHash))) return { error: "Das aktuelle Passwort stimmt nicht." };
  const problem = passwordProblem(next);
  if (problem) return { error: problem };
  if (next !== String(formData.get("repeat") ?? "")) return { error: "Die beiden neuen Passwörter stimmen nicht überein." };
  await db.update(schema.adminUsers).set({ passwordHash: await hashPassword(next) }).where(eq(schema.adminUsers.id, admin.id));
  const context = await currentAdmin();
  if (context) await db.delete(schema.adminSessions).where(and(eq(schema.adminSessions.adminId, admin.id), ne(schema.adminSessions.id, context.sessionId)));
  await audit(admin.id, "admin.password_changed", "admin", admin.id);
  return { done: "Passwort geändert. Andere Sitzungen wurden beendet." };
}

/** Creates a new, not yet active secret. It becomes active once a code from it is confirmed. */
export async function startTotpAction() {
  const admin = await requireAdmin("account");
  if (admin.totpEnabled) return;
  await db.update(schema.adminUsers).set({ totpSecret: sealSecret(newTotpSecret()), totpLastStep: null }).where(eq(schema.adminUsers.id, admin.id));
  revalidatePath("/admin/account");
}

export async function confirmTotpAction(_: AccountState, formData: FormData): Promise<AccountState> {
  const admin = await requireAdmin("account");
  if (!admin.totpSecret || admin.totpEnabled) return { error: "Bitte die Einrichtung neu starten." };
  const step = matchTotp(openSecret(admin.totpSecret), String(formData.get("code") ?? ""), null);
  if (step === null) return { error: "Der Code stimmt nicht. Uhrzeit des Geräts prüfen und den aktuellen Code eingeben." };
  await db.update(schema.adminUsers).set({ totpEnabled: true, totpLastStep: step }).where(eq(schema.adminUsers.id, admin.id));
  await audit(admin.id, "admin.2fa_enabled", "admin", admin.id);
  revalidatePath("/admin", "layout");
  return { done: "Zwei-Faktor-Anmeldung ist aktiv." };
}

/** Outside production two-factor sign-in can be turned off again with a valid code. */
export async function disableTotpAction(_: AccountState, formData: FormData): Promise<AccountState> {
  const admin = await requireAdmin("account");
  if (twoFactorRequired()) return { error: "Im Produktivbetrieb ist die Zwei-Faktor-Anmeldung Pflicht." };
  if (!admin.totpSecret || matchTotp(openSecret(admin.totpSecret), String(formData.get("code") ?? ""), admin.totpLastStep) === null) return { error: "Der Code stimmt nicht." };
  await db.update(schema.adminUsers).set({ totpEnabled: false, totpSecret: null, totpLastStep: null }).where(eq(schema.adminUsers.id, admin.id));
  await audit(admin.id, "admin.2fa_disabled", "admin", admin.id);
  revalidatePath("/admin", "layout");
  return { done: "Zwei-Faktor-Anmeldung entfernt." };
}

export async function endOtherSessionsAction() {
  const admin = await requireAdmin("account");
  const context = await currentAdmin();
  if (!context) return;
  await db.delete(schema.adminSessions).where(and(eq(schema.adminSessions.adminId, admin.id), ne(schema.adminSessions.id, context.sessionId)));
  await audit(admin.id, "admin.sessions_revoked", "admin", admin.id);
  revalidatePath("/admin/account");
}
