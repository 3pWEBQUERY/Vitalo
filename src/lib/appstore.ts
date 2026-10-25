import { X509Certificate } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { compactVerify, decodeProtectedHeader } from "jose";
import { db, schema } from "@/db";
import { ApiError } from "./api";

/**
 * App Store signed data (JWS) verification: the x5c chain must lead to Apple Root CA - G3
 * (bundled in certs/), each certificate must be valid now, and the payload must be signed by
 * the leaf. The server is the source of truth for the Plus status (PRD MON-02).
 */
const PRODUCTS = new Set(["ch.vitalo.plus.monthly", "ch.vitalo.plus.yearly"]);
const bundleId = () => process.env.APPLE_BUNDLE_ID ?? "ch.vitalo.app";
const appleRoot = new X509Certificate(readFileSync(path.join(process.cwd(), "certs", "AppleRootCA-G3.cer")));

function certificate(der: string): X509Certificate {
  return new X509Certificate(Buffer.from(der, "base64"));
}

function validNow(cert: X509Certificate, at = new Date()): boolean {
  return new Date(cert.validFrom) <= at && at <= new Date(cert.validTo);
}

/** Local StoreKit testing in Xcode signs with a local certificate; accepted only outside production. */
const allowXcode = () => process.env.NODE_ENV !== "production";

export async function verifySignedData<T>(jws: string): Promise<T> {
  let header;
  try {
    header = decodeProtectedHeader(jws);
  } catch {
    throw new ApiError(400, "invalid_signed_data");
  }
  let chain: X509Certificate[];
  let payloadPreview: { environment?: string; data?: { environment?: string } };
  try {
    chain = (header.x5c ?? []).map(certificate);
    payloadPreview = JSON.parse(Buffer.from(jws.split(".")[1] ?? "", "base64url").toString("utf8") || "{}");
  } catch {
    throw new ApiError(400, "invalid_certificate_chain");
  }
  if (chain.length < 1) throw new ApiError(400, "invalid_signed_data");
  const leaf = chain[0];
  const xcode = payloadPreview.environment === "Xcode" || payloadPreview.data?.environment === "Xcode";

  if (!(xcode && allowXcode())) {
    if (chain.length !== 3) throw new ApiError(400, "invalid_certificate_chain");
    const [, intermediate, root] = chain;
    const chainOk =
      root.raw.equals(appleRoot.raw) &&
      intermediate.verify(root.publicKey) &&
      leaf.verify(intermediate.publicKey) &&
      chain.every((c) => validNow(c));
    if (!chainOk) throw new ApiError(400, "invalid_certificate_chain");
  }
  try {
    const { payload } = await compactVerify(jws, leaf.publicKey);
    return JSON.parse(new TextDecoder().decode(payload)) as T;
  } catch {
    throw new ApiError(400, "invalid_signature");
  }
}

type TransactionPayload = {
  bundleId: string;
  productId: string;
  originalTransactionId: string;
  transactionId: string;
  expiresDate?: number;
  revocationDate?: number;
  appAccountToken?: string;
  environment: string;
};

function statusOf(t: TransactionPayload): "active" | "expired" | "revoked" {
  if (t.revocationDate) return "revoked";
  return t.expiresDate && t.expiresDate > Date.now() ? "active" : "expired";
}

async function applyStatus(userId: string, t: TransactionPayload, status: "active" | "grace" | "expired" | "revoked" | "refunded") {
  const expiresAt = t.expiresDate ? new Date(t.expiresDate) : null;
  await db
    .insert(schema.subscriptions)
    .values({ userId, productId: t.productId, originalTransactionId: t.originalTransactionId, status, expiresAt, environment: t.environment })
    .onConflictDoUpdate({ target: schema.subscriptions.userId, set: { productId: t.productId, originalTransactionId: t.originalTransactionId, status, expiresAt, environment: t.environment, updatedAt: new Date() } });
  const plus = status === "active" || status === "grace";
  await db.update(schema.users).set({ plan: plus ? "plus" : "free", planExpiresAt: expiresAt }).where(eq(schema.users.id, userId));
  return { plan: plus ? "plus" : "free", status, expiresAt };
}

/** Called by the app after a purchase or on launch with the latest signed transaction. */
export async function verifyPurchase(userId: string, signedTransaction: string) {
  const t = await verifySignedData<TransactionPayload>(signedTransaction);
  if (t.bundleId !== bundleId()) throw new ApiError(400, "wrong_bundle");
  if (!PRODUCTS.has(t.productId)) throw new ApiError(400, "unknown_product");
  if (t.appAccountToken && t.appAccountToken.toLowerCase() !== userId.toLowerCase()) throw new ApiError(409, "transaction_belongs_to_other_account");
  const [owner] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.originalTransactionId, t.originalTransactionId));
  if (owner && owner.userId !== userId) throw new ApiError(409, "transaction_belongs_to_other_account");
  return applyStatus(userId, t, statusOf(t));
}

type NotificationPayload = {
  notificationType: string;
  subtype?: string;
  notificationUUID: string;
  data?: { signedTransactionInfo?: string; bundleId?: string; environment?: string };
};

/** App Store Server Notifications v2: renewals, expiries, refunds and revocations. */
export async function handleNotification(signedPayload: string) {
  const n = await verifySignedData<NotificationPayload>(signedPayload);
  const t = n.data?.signedTransactionInfo ? await verifySignedData<TransactionPayload>(n.data.signedTransactionInfo) : null;
  const inserted = await db
    .insert(schema.appStoreEvents)
    .values({ notificationUuid: n.notificationUUID, notificationType: n.notificationType, subtype: n.subtype ?? null, originalTransactionId: t?.originalTransactionId ?? null, payload: { notification: n, transaction: t } })
    .onConflictDoNothing()
    .returning();
  if (!inserted.length || !t) return { handled: false };
  if (t.bundleId !== bundleId()) return { handled: false };
  const [subscription] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.originalTransactionId, t.originalTransactionId));
  const userId = subscription?.userId ?? t.appAccountToken;
  if (!userId) return { handled: false };
  const status =
    n.notificationType === "REFUND" ? "refunded" :
    n.notificationType === "REVOKE" ? "revoked" :
    n.notificationType === "EXPIRED" || n.notificationType === "GRACE_PERIOD_EXPIRED" ? "expired" :
    n.notificationType === "DID_FAIL_TO_RENEW" && n.subtype === "GRACE_PERIOD" ? "grace" :
    statusOf(t);
  await applyStatus(userId, t, status);
  return { handled: true, status };
}

/** Expired plans fall back to free even if no notification arrived. */
export async function effectivePlan(userId: string) {
  const [sub] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, userId));
  if (!sub) {
    // Plus granted by support (for example as a goodwill gesture) until a set date.
    const [user] = await db.select({ plan: schema.users.plan, until: schema.users.planExpiresAt }).from(schema.users).where(eq(schema.users.id, userId));
    const granted = user?.plan === "plus" && (!user.until || user.until > new Date());
    if (user?.plan === "plus" && !granted) await db.update(schema.users).set({ plan: "free", planExpiresAt: null }).where(eq(schema.users.id, userId));
    return granted ? { plan: "plus" as const, status: "complimentary" as const, expiresAt: user.until } : { plan: "free" as const, status: null, expiresAt: null };
  }
  const active = (sub.status === "active" || sub.status === "grace") && (!sub.expiresAt || sub.expiresAt > new Date());
  if (!active && sub.status === "active") {
    await db.update(schema.subscriptions).set({ status: "expired", updatedAt: new Date() }).where(eq(schema.subscriptions.userId, userId));
    await db.update(schema.users).set({ plan: "free" }).where(eq(schema.users.id, userId));
  }
  return { plan: active ? ("plus" as const) : ("free" as const), status: active ? sub.status : "expired", expiresAt: sub.expiresAt, productId: sub.productId };
}
