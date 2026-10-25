import http2 from "node:http2";
import { eq, inArray, sql } from "drizzle-orm";
import { importPKCS8, SignJWT } from "jose";
import { db, schema } from "@/db";

/**
 * Apple Push Notification service with token authentication (PRD 12.1). Messages never
 * contain weight or body values, so nothing sensitive shows on the lock screen (PRD 13.10).
 */
type PushKind = "reaction" | "comment" | "follow" | "group" | "weekly_review" | "coach";

const TEXT: Record<"de" | "en", Record<PushKind, [string, string]>> = {
  de: {
    reaction: ["Vitalo", "{name} hat auf deinen Beitrag reagiert."],
    comment: ["Vitalo", "{name} hat deinen Beitrag kommentiert."],
    follow: ["Vitalo", "{name} folgt dir jetzt."],
    group: ["Vitalo", "Neues in {name}."],
    weekly_review: ["Dein Wochenrückblick", "Sieh dir an, was gut lief, und eine Idee für die nächste Woche."],
    coach: ["Coach", "Es gibt einen neuen Vorschlag für dich."],
  },
  en: {
    reaction: ["Vitalo", "{name} reacted to your post."],
    comment: ["Vitalo", "{name} commented on your post."],
    follow: ["Vitalo", "{name} is now following you."],
    group: ["Vitalo", "New activity in {name}."],
    weekly_review: ["Your week in review", "See what went well and one idea for next week."],
    coach: ["Coach", "There's a new suggestion for you."],
  },
};

let cachedJwt: { token: string; at: number } | null = null;

function configured(): boolean {
  return Boolean(process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID && process.env.APNS_PRIVATE_KEY);
}

async function providerToken(): Promise<string> {
  // Apple accepts a token for up to an hour; refresh after 50 minutes.
  if (cachedJwt && Date.now() - cachedJwt.at < 50 * 60_000) return cachedJwt.token;
  const key = await importPKCS8(process.env.APNS_PRIVATE_KEY!.replace(/\\n/g, "\n"), "ES256");
  const token = await new SignJWT({}).setProtectedHeader({ alg: "ES256", kid: process.env.APNS_KEY_ID! }).setIssuer(process.env.APNS_TEAM_ID!).setIssuedAt().sign(key);
  cachedJwt = { token, at: Date.now() };
  return token;
}

async function deliver(token: string, environment: "production" | "sandbox", payload: object): Promise<"ok" | "invalid" | "error"> {
  const host = environment === "production" ? "https://api.push.apple.com" : "https://api.sandbox.push.apple.com";
  const jwt = await providerToken();
  return new Promise((resolve) => {
    const client = http2.connect(host);
    client.on("error", () => resolve("error"));
    const request = client.request({
      ":method": "POST",
      ":path": `/3/device/${token}`,
      authorization: `bearer ${jwt}`,
      "apns-topic": process.env.APNS_TOPIC ?? process.env.APPLE_BUNDLE_ID ?? "ch.vitalo.app",
      "apns-push-type": "alert",
      "content-type": "application/json",
    });
    let status = 0;
    let body = "";
    request.on("response", (headers) => (status = Number(headers[":status"])));
    request.on("data", (chunk) => (body += chunk));
    request.on("end", () => {
      client.close();
      if (status === 200) resolve("ok");
      else if (status === 410 || body.includes("BadDeviceToken") || body.includes("Unregistered")) resolve("invalid");
      else resolve("error");
    });
    request.setTimeout(8000, () => {
      request.close();
      client.close();
      resolve("error");
    });
    request.end(JSON.stringify(payload));
  });
}

type Preferences = Partial<Record<PushKind, boolean>> & { quietStart?: number; quietEnd?: number };

function inQuietHours(prefs: Preferences): boolean {
  if (prefs.quietStart === undefined || prefs.quietEnd === undefined) return false;
  const hour = new Date().getUTCHours();
  return prefs.quietStart <= prefs.quietEnd ? hour >= prefs.quietStart && hour < prefs.quietEnd : hour >= prefs.quietStart || hour < prefs.quietEnd;
}

/** Sends one notification to all of a person's devices, honouring per-type settings and quiet hours (COM-12). */
export async function notify(userId: string, kind: PushKind, name = ""): Promise<number> {
  if (!configured()) return 0;
  const [profile] = await db.select({ settings: schema.profiles.settings, locale: schema.profiles.locale }).from(schema.profiles).where(eq(schema.profiles.userId, userId));
  const prefs = ((profile?.settings as Record<string, unknown> | undefined)?.notifications ?? {}) as Preferences;
  if (prefs[kind] === false || inQuietHours(prefs)) return 0;
  const tokens = await db.select().from(schema.pushTokens).where(eq(schema.pushTokens.userId, userId));
  const language = (profile?.locale ?? "de").startsWith("de") ? "de" : "en";
  const [title, body] = TEXT[language][kind];
  const payload = { aps: { alert: { title, body: body.replace("{name}", name) }, sound: "default", "thread-id": kind }, kind };
  const invalid: string[] = [];
  let sent = 0;
  for (const t of tokens) {
    const result = await deliver(t.token, t.environment, payload);
    if (result === "ok") sent++;
    if (result === "invalid") invalid.push(t.token);
  }
  if (invalid.length) await db.delete(schema.pushTokens).where(inArray(schema.pushTokens.token, invalid));
  return sent;
}

/** Weekly review reminder for everyone who logged in the last week. */
export async function sendWeeklyReviewPushes(): Promise<{ sent: number }> {
  if (!configured()) return { sent: 0 };
  const users = await db.execute<{ user_id: string }>(sql`select distinct user_id from meal_entries where updated_at > now() - interval '7 days'`);
  let sent = 0;
  for (const { user_id } of users) sent += await notify(user_id, "weekly_review");
  return { sent };
}

export const pushConfigured = configured;
