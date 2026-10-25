"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { approveContent, decideAppeal, dismissReports, liftSanction, removeContent, sanction } from "@/lib/moderation";

const target = z.object({ targetType: z.enum(["post", "comment", "user", "group", "food"]), targetId: z.uuid() });
const fields = (formData: FormData) => Object.fromEntries(formData.entries());

function done() {
  revalidatePath("/admin/moderation");
  revalidatePath("/admin", "layout");
}

export async function dismissAction(formData: FormData): Promise<{ message: string }> {
  const admin = await requireAdmin("moderation");
  const { targetType, targetId } = target.parse(fields(formData));
  await dismissReports(admin.id, targetType, targetId);
  done();
  return { message: "Meldung verworfen." };
}

export async function removeAction(formData: FormData): Promise<{ message: string }> {
  const admin = await requireAdmin("moderation");
  const { targetType, targetId } = target.parse(fields(formData));
  await removeContent(admin.id, targetType, targetId);
  done();
  return { message: "Inhalt entfernt." };
}

export async function approveAction(formData: FormData): Promise<{ message: string }> {
  const admin = await requireAdmin("moderation");
  const { targetType, targetId } = z.object({ targetType: z.enum(["post", "comment"]), targetId: z.uuid() }).parse(fields(formData));
  await approveContent(admin.id, targetType, targetId);
  done();
  return { message: "Freigegeben." };
}

const sanctionInput = z.object({
  userId: z.uuid(),
  kind: z.enum(["warning", "suspension", "ban"]),
  reason: z.string().trim().min(3).max(500),
  days: z.coerce.number().int().min(1).max(365).optional(),
  targetType: z.enum(["post", "comment", "user", "group", "food"]).optional(),
  targetId: z.uuid().optional(),
});

/** Sanctioning from a report also removes the reported content. */
export async function sanctionAction(formData: FormData): Promise<{ message: string }> {
  const admin = await requireAdmin("moderation");
  const input = sanctionInput.parse(fields(formData));
  if (input.targetType && input.targetId && input.targetType !== "user") await removeContent(admin.id, input.targetType, input.targetId);
  await sanction(admin.id, input.userId, input.kind, input.reason, input.days);
  if (input.targetType === "user" && input.targetId) await dismissReports(admin.id, "user", input.targetId);
  done();
  revalidatePath(`/admin/users/${input.userId}`);
  return { message: input.kind === "warning" ? "Verwarnung ausgesprochen." : input.kind === "suspension" ? "Person gesperrt." : "Person aus der Community ausgeschlossen." };
}

export async function liftSanctionAction(formData: FormData): Promise<{ message: string }> {
  const admin = await requireAdmin("moderation");
  await liftSanction(admin.id, z.uuid().parse(formData.get("sanctionId")));
  done();
  revalidatePath("/admin/users", "layout");
  return { message: "Sanktion aufgehoben." };
}

export async function appealAction(formData: FormData): Promise<{ message: string }> {
  const admin = await requireAdmin("moderation");
  const { appealId, decision } = z.object({ appealId: z.uuid(), decision: z.enum(["grant", "deny"]) }).parse(fields(formData));
  await decideAppeal(admin.id, appealId, decision === "grant");
  done();
  return { message: decision === "grant" ? "Einspruch stattgegeben, Sanktion aufgehoben." : "Einspruch abgelehnt." };
}
