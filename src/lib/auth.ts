import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT } from "jose";
import type { NextRequest } from "next/server";
import { db, schema } from "@/db";
import type { User } from "@/db/schema";
import { ApiError, unauthorized } from "./api";

const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL_MS = 60 * 24 * 60 * 60 * 1000;
const APPLE_ISSUER = "https://appleid.apple.com";
const appleKeys = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET;
  if (!value) {
    if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET is required in production");
    return new TextEncoder().encode("vitalo-development-secret-do-not-use-in-production");
  }
  return new TextEncoder().encode(value);
}

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export type TokenPair = { accessToken: string; refreshToken: string; expiresIn: number };

async function accessToken(userId: string, sessionId: string): Promise<string> {
  return new SignJWT({ sid: sessionId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer("vitalo")
    .setAudience("vitalo-app")
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL_SECONDS}s`)
    .sign(secret());
}

/** Creates a device session: short-lived access token and a rotating refresh token stored only as a hash. */
export async function startSession(userId: string, device: { name?: string; appVersion?: string }): Promise<TokenPair> {
  const refreshToken = randomBytes(32).toString("base64url");
  const [session] = await db
    .insert(schema.deviceSessions)
    .values({ userId, refreshHash: hashToken(refreshToken), deviceName: device.name ?? null, appVersion: device.appVersion ?? null, expiresAt: new Date(Date.now() + REFRESH_TTL_MS) })
    .returning();
  return { accessToken: await accessToken(userId, session.id), refreshToken, expiresIn: ACCESS_TTL_SECONDS };
}

/** Exchanges a refresh token for a new pair. The old refresh token stops working immediately. */
export async function refreshSession(refreshToken: string): Promise<TokenPair> {
  const [session] = await db
    .select()
    .from(schema.deviceSessions)
    .where(and(eq(schema.deviceSessions.refreshHash, hashToken(refreshToken)), isNull(schema.deviceSessions.revokedAt), gt(schema.deviceSessions.expiresAt, new Date())))
    .limit(1);
  if (!session) throw unauthorized("invalid_refresh_token");
  await activeUser(session.userId);
  const next = randomBytes(32).toString("base64url");
  await db
    .update(schema.deviceSessions)
    .set({ refreshHash: hashToken(next), lastUsedAt: new Date(), expiresAt: new Date(Date.now() + REFRESH_TTL_MS) })
    .where(eq(schema.deviceSessions.id, session.id));
  return { accessToken: await accessToken(session.userId, session.id), refreshToken: next, expiresIn: ACCESS_TTL_SECONDS };
}

export async function endSession(sessionId: string): Promise<void> {
  await db.update(schema.deviceSessions).set({ revokedAt: new Date() }).where(eq(schema.deviceSessions.id, sessionId));
}

async function activeUser(userId: string): Promise<User> {
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!user || user.deletedAt) throw unauthorized("account_deleted");
  if (user.lockedAt) throw new ApiError(403, "account_locked", user.lockReason ?? undefined);
  return user;
}

export type Session = { user: User; sessionId: string };

/** Reads the bearer token. Every user query is then scoped to session.user.id. */
export async function requireUser(request: NextRequest): Promise<Session> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw unauthorized();
  let payload;
  try {
    ({ payload } = await jwtVerify(token, secret(), { issuer: "vitalo", audience: "vitalo-app" }));
  } catch {
    throw unauthorized("invalid_token");
  }
  const sessionId = String(payload.sid ?? "");
  const [session] = await db.select().from(schema.deviceSessions).where(eq(schema.deviceSessions.id, sessionId)).limit(1);
  if (!session || session.revokedAt) throw unauthorized("session_revoked");
  return { user: await activeUser(String(payload.sub)), sessionId };
}

// MARK: Sign in with Apple

const bundleId = () => process.env.APPLE_BUNDLE_ID ?? "ch.vitalo.app";

/** Verifies the identity token's signature, issuer, audience and expiry against Apple's keys. */
export async function verifyAppleIdentity(identityToken: string, nonce?: string): Promise<{ sub: string; email?: string }> {
  try {
    const { payload } = await jwtVerify(identityToken, appleKeys, { issuer: APPLE_ISSUER, audience: bundleId() });
    if (nonce && payload.nonce !== createHash("sha256").update(nonce).digest("hex")) throw new Error("nonce mismatch");
    return { sub: String(payload.sub), email: typeof payload.email === "string" ? payload.email : undefined };
  } catch {
    throw unauthorized("invalid_apple_token");
  }
}

function appleConfigured(): boolean {
  return Boolean(process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID && process.env.APPLE_PRIVATE_KEY);
}

async function appleClientSecret(): Promise<string> {
  const key = await importPKCS8(process.env.APPLE_PRIVATE_KEY!.replace(/\\n/g, "\n"), "ES256");
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: process.env.APPLE_KEY_ID! })
    .setIssuer(process.env.APPLE_TEAM_ID!)
    .setAudience(APPLE_ISSUER)
    .setSubject(bundleId())
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(key);
}

/** Exchanges the one-time authorization code for Apple's refresh token, kept to revoke on deletion. */
export async function exchangeAppleCode(code: string): Promise<string | null> {
  if (!appleConfigured()) return null;
  const response = await fetch(`${APPLE_ISSUER}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: bundleId(), client_secret: await appleClientSecret(), code, grant_type: "authorization_code" }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!response?.ok) return null;
  const data = (await response.json()) as { refresh_token?: string };
  return data.refresh_token ?? null;
}

export async function revokeAppleToken(refreshToken: string): Promise<boolean> {
  if (!appleConfigured()) return false;
  const response = await fetch(`${APPLE_ISSUER}/auth/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: bundleId(), client_secret: await appleClientSecret(), token: refreshToken, token_type_hint: "refresh_token" }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  return Boolean(response?.ok);
}

export const devLoginAllowed = () => process.env.NODE_ENV !== "production" && process.env.ALLOW_DEV_LOGIN !== "false";
