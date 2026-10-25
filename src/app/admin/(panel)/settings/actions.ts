"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db";
import { audit, requireAdmin } from "@/lib/admin";
import { invalidateSettings, updateSetting } from "@/lib/settings";
import { SETTINGS, type SettingKey } from "./definitions";

export type SettingState = { error?: string; saved?: string; message?: string };

function refresh() {
  invalidateSettings();
  revalidatePath("/admin/settings");
  revalidatePath("/admin/ai");
}

export async function updateSettingAction(_: SettingState, formData: FormData): Promise<SettingState> {
  const admin = await requireAdmin("settings");
  const key = String(formData.get("key")) as SettingKey;
  const definition = SETTINGS[key];
  if (!definition) return { error: "Unbekannte Einstellung." };
  const parsed = definition.schema.safeParse(formData.get("value"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ungültiger Wert." };
  const [before] = await db.select().from(schema.appSettings).where(eq(schema.appSettings.key, key));
  await updateSetting(key, parsed.data);
  await audit(admin.id, "setting.update", "setting", key, { from: before?.value, to: parsed.data });
  refresh();
  return { saved: key };
}

export async function toggleFlagAction(formData: FormData): Promise<{ message: string }> {
  const admin = await requireAdmin("settings");
  const { key, enabled } = z.object({ key: z.string().regex(/^[a-z0-9_]+$/), enabled: z.enum(["true", "false"]) }).parse(Object.fromEntries(formData.entries()));
  await db.update(schema.featureFlags).set({ enabled: enabled === "true", updatedAt: new Date() }).where(eq(schema.featureFlags.key, key));
  await audit(admin.id, "flag.update", "flag", key, { enabled: enabled === "true" });
  refresh();
  return { message: enabled === "true" ? `„${key}“ eingeschaltet.` : `„${key}“ ausgeschaltet.` };
}

/** The kill switch stops every AI call at once, without a deploy (PRD 13.4). */
export async function killSwitchAction(formData: FormData): Promise<{ message: string }> {
  const admin = await requireAdmin("ai");
  const on = formData.get("on") === "true";
  await updateSetting("ai_kill_switch", on);
  await audit(admin.id, "setting.update", "setting", "ai_kill_switch", { to: on });
  refresh();
  return { message: on ? "KI ist abgeschaltet." : "KI ist wieder eingeschaltet." };
}

/** Flags the code relies on; they can be switched but not removed. */
const CORE_FLAGS = ["community", "ai_photo", "ai_text", "coach", "coach_ai_wording"];

export async function createFlagAction(_: SettingState, formData: FormData): Promise<SettingState & { message?: string }> {
  const admin = await requireAdmin("settings");
  const parsed = z
    .object({
      key: z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9_]{2,40}$/, "Schlüssel: 3–41 Zeichen, a–z, 0–9 und _, beginnt mit einem Buchstaben."),
      description: z.string().trim().max(200),
      enabled: z.enum(["on"]).optional(),
    })
    .safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const [exists] = await db.select().from(schema.featureFlags).where(eq(schema.featureFlags.key, parsed.data.key));
  if (exists) return { error: "Diesen Schlüssel gibt es schon." };
  await db.insert(schema.featureFlags).values({ key: parsed.data.key, description: parsed.data.description, enabled: parsed.data.enabled === "on" });
  await audit(admin.id, "flag.create", "flag", parsed.data.key, { enabled: parsed.data.enabled === "on" });
  refresh();
  return { message: `Funktion „${parsed.data.key}“ angelegt.` };
}

export async function updateFlagAction(formData: FormData): Promise<{ message?: string; error?: string }> {
  const admin = await requireAdmin("settings");
  const { key, description } = z.object({ key: z.string(), description: z.string().trim().max(200) }).parse(Object.fromEntries(formData.entries()));
  await db.update(schema.featureFlags).set({ description, updatedAt: new Date() }).where(eq(schema.featureFlags.key, key));
  await audit(admin.id, "flag.edit", "flag", key, { description });
  refresh();
  return { message: "Beschreibung gespeichert." };
}

export async function deleteFlagAction(formData: FormData): Promise<{ message?: string; error?: string }> {
  const admin = await requireAdmin("settings");
  const key = z.string().parse(formData.get("key"));
  if (CORE_FLAGS.includes(key)) return { error: "Diese Funktion wird von der App verwendet und kann nur ausgeschaltet werden." };
  await db.delete(schema.featureFlags).where(eq(schema.featureFlags.key, key));
  await audit(admin.id, "flag.delete", "flag", key);
  refresh();
  return { message: `Funktion „${key}“ gelöscht.` };
}

