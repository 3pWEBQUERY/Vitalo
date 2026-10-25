import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { and, eq, gt } from "drizzle-orm";
import { jwtVerify, SignJWT } from "jose";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import type { AdminUser } from "@/db/core";
import { hashToken } from "./auth";

const scrypt = promisify(scryptCallback) as (password: string, salt: Buffer, length: number, options: { N: number; r: number; p: number; maxmem: number }) => Promise<Buffer>;

export type Role = AdminUser["role"];
export const ROLES: Role[] = ["admin", "moderator", "editor", "support"];
export const ROLE_NAMES: Record<Role, string> = { admin: "Administration", moderator: "Moderation", editor: "Redaktion", support: "Support" };
export const ROLE_TEXT: Record<Role, string> = {
  admin: "Alles, inklusive Team, Einstellungen und KI-Kosten",
  moderator: "Meldungen, Beiträge, Gruppen, Challenges, Sanktionen",
  editor: "Lebensmittel und Marken",
  support: "Konten und Abos, ohne Gesundheitsdaten",
};

/** Who may open which area. Support never sees health data; editors only maintain foods and brands. */
const ACCESS = {
  overview: ["admin", "moderator", "editor", "support"],
  moderation: ["admin", "moderator"],
  foods: ["admin", "editor"],
  brands: ["admin", "editor"],
  users: ["admin", "support"],
  ai: ["admin"],
  settings: ["admin"],
  audit: ["admin"],
  team: ["admin"],
} as const satisfies Record<string, readonly Role[]>;
export type Area = keyof typeof ACCESS;

export const canAccess = (role: Role, area: Area) => (ACCESS[area] as readonly Role[]).includes(role);

export const SESSION_COOKIE = "vitalo_admin";
const PENDING_COOKIE = "vitalo_admin_2fa";
const IDLE_MS = 2 * 60 * 60_000;
const MAX_MS = 12 * 60 * 60_000;
const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60_000;
const production = () => process.env.NODE_ENV === "production";

function key(purpose: string): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret && production()) throw new Error("AUTH_SECRET is required in production");
  return createHash("sha256").update(`${purpose}:${secret ?? "vitalo-development-secret-do-not-use-in-production"}`).digest();
}

// MARK: Passwords

const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password.normalize("NFKC"), salt, 64, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = await scrypt(password.normalize("NFKC"), Buffer.from(salt, "base64"), expected.length, { N: Number(n), r: Number(r), p: Number(p), maxmem: SCRYPT.maxmem });
  return timingSafeEqual(actual, expected);
}

export function passwordProblem(password: string): string | null {
  if (password.length < 12) return "Das Passwort braucht mindestens 12 Zeichen.";
  if (password.length > 200) return "Das Passwort ist zu lang.";
  if (new Set(password).size < 6) return "Das Passwort ist zu einfach.";
  return null;
}

// MARK: TOTP (RFC 6238, 30 s, 6 digits, SHA-1 for authenticator compatibility)

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(bytes: Buffer): string {
  let bits = 0, value = 0, out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(text: string): Buffer {
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const char of text.replace(/=+$/, "").toUpperCase()) {
    const index = BASE32.indexOf(char);
    if (index < 0) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function totpAt(secret: Buffer, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac("sha1", secret).update(counter).digest();
  const offset = digest[digest.length - 1] & 15;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

export const newTotpSecret = () => base32Encode(randomBytes(20));

export function totpURI(secret: string, email: string): string {
  const label = encodeURIComponent(`Vitalo Admin:${email}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent("Vitalo Admin")}&algorithm=SHA1&digits=6&period=30`;
}

/** Returns the matched time step (±1 step of clock drift), or null. */
export function matchTotp(secret: string, code: string, lastStep: number | null): number | null {
  const clean = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return null;
  const now = Math.floor(Date.now() / 30_000);
  const bytes = base32Decode(secret);
  for (const step of [now, now - 1, now + 1]) {
    if (lastStep !== null && step <= lastStep) continue;
    if (timingSafeEqual(Buffer.from(totpAt(bytes, step)), Buffer.from(clean))) return step;
  }
  return null;
}

/** TOTP secrets are stored encrypted (AES-256-GCM) so a database copy alone cannot produce codes. */
export function sealSecret(secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key("totp"), iv);
  const data = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64")}.${cipher.getAuthTag().toString("base64")}.${data.toString("base64")}`;
}

export function openSecret(sealed: string): string {
  const [version, iv, tag, data] = sealed.split(".");
  if (version !== "v1") throw new Error("unknown secret format");
  const decipher = createDecipheriv("aes-256-gcm", key("totp"), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}

// MARK: Sign-in

export type SignInResult = { ok: true; needsCode: boolean } | { ok: false; error: string };

const GENERIC = "E-Mail-Adresse oder Passwort stimmen nicht.";

async function registerFailure(admin: AdminUser): Promise<void> {
  const failures = admin.failedLogins + 1;
  await db
    .update(schema.adminUsers)
    .set({ failedLogins: failures, lockedUntil: failures >= MAX_FAILURES ? new Date(Date.now() + LOCK_MS) : admin.lockedUntil })
    .where(eq(schema.adminUsers.id, admin.id));
  if (failures >= MAX_FAILURES) await audit(admin.id, "admin.locked", "admin", admin.id, { failures });
}

function lockedMessage(admin: AdminUser): string | null {
  if (admin.disabledAt) return GENERIC;
  if (admin.lockedUntil && admin.lockedUntil > new Date()) {
    const minutes = Math.ceil((admin.lockedUntil.getTime() - Date.now()) / 60_000);
    return `Zu viele Fehlversuche. Bitte in ${minutes} ${minutes === 1 ? "Minute" : "Minuten"} erneut versuchen.`;
  }
  return null;
}

/** Step 1: password. With two-factor enabled a short-lived pending cookie leads to step 2. */
export async function signInWithPassword(email: string, password: string): Promise<SignInResult> {
  const [admin] = await db.select().from(schema.adminUsers).where(eq(schema.adminUsers.email, email.trim().toLowerCase()));
  if (!admin) {
    await hashPassword(password); // same timing whether or not the address exists
    return { ok: false, error: GENERIC };
  }
  const locked = lockedMessage(admin);
  if (locked) return { ok: false, error: locked };
  if (!(await verifyPassword(password, admin.passwordHash))) {
    await registerFailure(admin);
    return { ok: false, error: GENERIC };
  }
  if (admin.totpEnabled && admin.totpSecret) {
    const pending = await new SignJWT({ stage: "totp" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(admin.id)
      .setAudience("vitalo-admin-2fa")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(key("admin-2fa"));
    (await cookies()).set(PENDING_COOKIE, pending, { httpOnly: true, secure: production(), sameSite: "lax", path: "/admin", maxAge: 300 });
    return { ok: true, needsCode: true };
  }
  await createSession(admin);
  return { ok: true, needsCode: false };
}

export async function pendingAdmin(): Promise<AdminUser | null> {
  const token = (await cookies()).get(PENDING_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key("admin-2fa"), { audience: "vitalo-admin-2fa" });
    const [admin] = await db.select().from(schema.adminUsers).where(eq(schema.adminUsers.id, String(payload.sub)));
    return admin && !admin.disabledAt ? admin : null;
  } catch {
    return null;
  }
}

/** Step 2: the authenticator code. Each code works once. */
export async function signInWithCode(code: string): Promise<SignInResult> {
  const admin = await pendingAdmin();
  if (!admin || !admin.totpSecret) return { ok: false, error: "Die Anmeldung ist abgelaufen. Bitte erneut anmelden." };
  const locked = lockedMessage(admin);
  if (locked) return { ok: false, error: locked };
  const step = matchTotp(openSecret(admin.totpSecret), code, admin.totpLastStep);
  if (step === null) {
    await registerFailure(admin);
    return { ok: false, error: "Der Code stimmt nicht. Bitte den aktuellen Code aus der Authenticator-App eingeben." };
  }
  await db.update(schema.adminUsers).set({ totpLastStep: step }).where(eq(schema.adminUsers.id, admin.id));
  (await cookies()).delete({ name: PENDING_COOKIE, path: "/admin" });
  await createSession(admin);
  return { ok: true, needsCode: false };
}

async function createSession(admin: AdminUser): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const request = await headers();
  const ip = request.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  await db.insert(schema.adminSessions).values({
    adminId: admin.id,
    tokenHash: hashToken(token),
    ip,
    userAgent: request.get("user-agent")?.slice(0, 300) ?? null,
    expiresAt: new Date(Date.now() + MAX_MS),
  });
  await db.update(schema.adminUsers).set({ lastLoginAt: new Date(), failedLogins: 0, lockedUntil: null }).where(eq(schema.adminUsers.id, admin.id));
  // Lax, not Strict: Safari withholds Strict cookies from every request of a page that was opened
  // through a link from another site or app, so server actions arrived signed out. Lax cookies are
  // still never sent with cross-site POSTs, and actions and admin routes check the Origin as well.
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, secure: production(), sameSite: "lax", path: "/", maxAge: MAX_MS / 1000 });
  await audit(admin.id, "admin.sign_in", "admin", admin.id, { ip });
}

export async function signOut(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    const [session] = await db.delete(schema.adminSessions).where(eq(schema.adminSessions.tokenHash, hashToken(token))).returning();
    if (session) await audit(session.adminId, "admin.sign_out", "admin", session.adminId);
  }
  store.delete(SESSION_COOKIE);
}

// MARK: Access

export type AdminContext = { admin: AdminUser; sessionId: string };

/** The signed-in admin, or null. Sessions end after 2 h without activity or 12 h in total. */
export async function currentAdmin(): Promise<AdminContext | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [row] = await db
    .select({ session: schema.adminSessions, admin: schema.adminUsers })
    .from(schema.adminSessions)
    .innerJoin(schema.adminUsers, eq(schema.adminUsers.id, schema.adminSessions.adminId))
    .where(and(eq(schema.adminSessions.tokenHash, hashToken(token)), gt(schema.adminSessions.expiresAt, new Date())));
  if (!row || row.admin.disabledAt) return null;
  if (Date.now() - row.session.lastSeenAt.getTime() > IDLE_MS) {
    await db.delete(schema.adminSessions).where(eq(schema.adminSessions.id, row.session.id));
    return null;
  }
  if (Date.now() - row.session.lastSeenAt.getTime() > 60_000) {
    await db.update(schema.adminSessions).set({ lastSeenAt: new Date() }).where(eq(schema.adminSessions.id, row.session.id));
  }
  return { admin: row.admin, sessionId: row.session.id };
}

/**
 * Guards every admin page and server action. In production two-factor sign-in is mandatory:
 * without it only the account page (to set it up) is reachable.
 */
export async function requireAdmin(area: Area | "account" = "overview"): Promise<AdminUser> {
  const context = await currentAdmin();
  if (!context) redirect("/admin/login");
  const { admin } = context;
  if (area !== "account" && production() && !admin.totpEnabled) redirect("/admin/account?setup=2fa");
  if (area !== "account" && !canAccess(admin.role, area)) redirect("/admin?denied=1");
  return admin;
}

export const twoFactorRequired = production;

// MARK: Audit

/** Every change made in the admin area is recorded with who, what and when (PRD 15.6). */
export async function audit(adminId: string | null, action: string, targetType?: string, targetId?: string, details?: Record<string, unknown>): Promise<void> {
  await db.insert(schema.auditLog).values({ adminId, action, targetType: targetType ?? null, targetId: targetId ?? null, details: details ?? null });
}
