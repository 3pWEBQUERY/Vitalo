"use server";

import { redirect } from "next/navigation";
import { signInWithCode, signInWithPassword, signOut } from "@/lib/admin";
import { rateLimit } from "@/lib/api";
import { headers } from "next/headers";

export type LoginState = { error?: string; email?: string };

async function limit(scope: string): Promise<string | null> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  try {
    rateLimit(`admin-login:${scope}:${ip}`, 20, 15 * 60_000);
    return null;
  } catch {
    return "Zu viele Anmeldeversuche. Bitte in einigen Minuten erneut versuchen.";
  }
}

export async function passwordAction(_: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Bitte E-Mail-Adresse und Passwort eingeben.", email };
  const limited = await limit("password");
  if (limited) return { error: limited, email };
  const result = await signInWithPassword(email, password);
  if (!result.ok) return { error: result.error, email };
  redirect(result.needsCode ? "/admin/login/code" : "/admin");
}

export async function codeAction(_: LoginState, formData: FormData): Promise<LoginState> {
  const limited = await limit("code");
  if (limited) return { error: limited };
  const result = await signInWithCode(String(formData.get("code") ?? ""));
  if (!result.ok) return { error: result.error };
  redirect("/admin");
}

export async function signOutAction(): Promise<void> {
  await signOut();
  redirect("/admin/login");
}
