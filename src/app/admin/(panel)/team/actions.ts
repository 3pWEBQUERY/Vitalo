"use server";

import { and, count, eq, isNull, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { audit, hashPassword, passwordProblem, requireAdmin } from "@/lib/admin";

type Result = { error?: string; message?: string };
const roles = z.enum(["admin", "moderator", "editor", "support"]);
const fields = (formData: FormData) => Object.fromEntries(formData.entries());

async function otherActiveAdmins(adminId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(schema.adminUsers)
    .where(and(eq(schema.adminUsers.role, "admin"), isNull(schema.adminUsers.disabledAt), ne(schema.adminUsers.id, adminId)));
  return row.n;
}

function refresh(id?: string) {
  revalidatePath("/admin/team");
  if (id) revalidatePath(`/admin/team/${id}`);
}

export async function inviteAction(_: Result, formData: FormData): Promise<Result> {
  const admin = await requireAdmin("team");
  const parsed = z
    .object({ email: z.email("Bitte eine gültige E-Mail-Adresse eingeben.").transform((e) => e.toLowerCase()), name: z.string().trim().min(2, "Bitte einen Namen eingeben.").max(80), role: roles, password: z.string() })
    .safeParse(fields(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const problem = passwordProblem(parsed.data.password);
  if (problem) return { error: problem };
  const [exists] = await db.select().from(schema.adminUsers).where(eq(schema.adminUsers.email, parsed.data.email));
  if (exists) return { error: "Für diese Adresse gibt es schon ein Konto." };
  const [created] = await db
    .insert(schema.adminUsers)
    .values({ email: parsed.data.email, name: parsed.data.name, role: parsed.data.role, passwordHash: await hashPassword(parsed.data.password) })
    .returning();
  await audit(admin.id, "admin.created", "admin", created.id, { email: created.email, role: created.role });
  refresh();
  redirect(`/admin/team/${created.id}?created=1`);
}

/** Name, address and role. The last active administrator keeps the admin role. */
export async function updateMemberAction(_: Result, formData: FormData): Promise<Result> {
  const admin = await requireAdmin("team");
  const parsed = z
    .object({ id: z.uuid(), name: z.string().trim().min(2, "Bitte einen Namen eingeben.").max(80), email: z.email("Bitte eine gültige E-Mail-Adresse eingeben.").transform((e) => e.toLowerCase()), role: roles })
    .safeParse(fields(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { id, ...values } = parsed.data;
  const [target] = await db.select().from(schema.adminUsers).where(eq(schema.adminUsers.id, id));
  if (!target) return { error: "Dieses Konto gibt es nicht mehr." };
  if (id === admin.id && values.role !== target.role) return { error: "Die eigene Rolle kann nur eine andere Person ändern." };
  if (target.role === "admin" && values.role !== "admin" && (await otherActiveAdmins(id)) === 0) return { error: "Es muss mindestens eine aktive Administration geben." };
  const [taken] = await db.select().from(schema.adminUsers).where(and(eq(schema.adminUsers.email, values.email), ne(schema.adminUsers.id, id)));
  if (taken) return { error: "Diese E-Mail-Adresse gehört schon zu einem anderen Konto." };
  await db.update(schema.adminUsers).set(values).where(eq(schema.adminUsers.id, id));
  if (target.role !== values.role) await audit(admin.id, "admin.role_changed", "admin", id, { from: target.role, to: values.role });
  await audit(admin.id, "admin.updated", "admin", id, { name: values.name, email: values.email });
  refresh(id);
  return { message: "Gespeichert." };
}

/** Sets a new password for someone who lost theirs; all their sessions end. */
export async function setPasswordAction(_: Result, formData: FormData): Promise<Result> {
  const admin = await requireAdmin("team");
  const id = z.uuid().parse(formData.get("id"));
  const password = String(formData.get("password") ?? "");
  const problem = passwordProblem(password);
  if (problem) return { error: problem };
  await db.update(schema.adminUsers).set({ passwordHash: await hashPassword(password), failedLogins: 0, lockedUntil: null }).where(eq(schema.adminUsers.id, id));
  await db.delete(schema.adminSessions).where(eq(schema.adminSessions.adminId, id));
  await audit(admin.id, "admin.password_reset", "admin", id);
  refresh(id);
  return { message: "Neues Passwort gesetzt. Bitte sicher weitergeben." };
}

export async function memberStatusAction(formData: FormData): Promise<Result> {
  const admin = await requireAdmin("team");
  const { id, op } = z.object({ id: z.uuid(), op: z.enum(["disable", "enable", "reset_2fa", "end_sessions", "unlock"]) }).parse(fields(formData));
  if (id === admin.id && op !== "end_sessions") return { error: "Das geht nur bei anderen Konten." };
  const [target] = await db.select().from(schema.adminUsers).where(eq(schema.adminUsers.id, id));
  if (!target) return { error: "Dieses Konto gibt es nicht mehr." };
  if (op === "disable") {
    if (target.role === "admin" && (await otherActiveAdmins(id)) === 0) return { error: "Die letzte aktive Administration kann nicht deaktiviert werden." };
    await db.update(schema.adminUsers).set({ disabledAt: new Date() }).where(eq(schema.adminUsers.id, id));
    await db.delete(schema.adminSessions).where(eq(schema.adminSessions.adminId, id));
    await audit(admin.id, "admin.disabled", "admin", id);
  } else if (op === "enable") {
    await db.update(schema.adminUsers).set({ disabledAt: null, failedLogins: 0, lockedUntil: null }).where(eq(schema.adminUsers.id, id));
    await audit(admin.id, "admin.enabled", "admin", id);
  } else if (op === "unlock") {
    await db.update(schema.adminUsers).set({ failedLogins: 0, lockedUntil: null }).where(eq(schema.adminUsers.id, id));
    await audit(admin.id, "admin.enabled", "admin", id, { unlocked: true });
  } else if (op === "reset_2fa") {
    await db.update(schema.adminUsers).set({ totpEnabled: false, totpSecret: null, totpLastStep: null }).where(eq(schema.adminUsers.id, id));
    await db.delete(schema.adminSessions).where(eq(schema.adminSessions.adminId, id));
    await audit(admin.id, "admin.2fa_disabled", "admin", id, { by: "team" });
  } else {
    await db.delete(schema.adminSessions).where(eq(schema.adminSessions.adminId, id));
    await audit(admin.id, "admin.sessions_revoked", "admin", id);
  }
  refresh(id);
  const messages = { disable: "Zugang deaktiviert.", enable: "Zugang reaktiviert.", unlock: "Sperre aufgehoben.", reset_2fa: "Zwei-Faktor-Anmeldung zurückgesetzt.", end_sessions: "Alle Sitzungen beendet." } as const;
  return { message: messages[op] };
}

/** Removes the account. Audit entries keep the person's actions but lose the name link. */
export async function deleteMemberAction(formData: FormData) {
  const admin = await requireAdmin("team");
  const id = z.uuid().parse(formData.get("id"));
  if (id === admin.id) return;
  const [target] = await db.select().from(schema.adminUsers).where(eq(schema.adminUsers.id, id));
  if (!target) return;
  if (target.role === "admin" && (await otherActiveAdmins(id)) === 0) return;
  await db.delete(schema.adminSessions).where(eq(schema.adminSessions.adminId, id));
  await db.delete(schema.adminUsers).where(eq(schema.adminUsers.id, id));
  await audit(admin.id, "admin.deleted", "admin", id, { email: target.email, name: target.name });
  refresh();
  redirect("/admin/team?deleted=1");
}
