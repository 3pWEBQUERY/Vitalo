import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { currentAdmin, newTotpSecret, sealSecret } from "@/lib/admin";

/**
 * Starts two-factor setup from a plain HTML form and reloads the account page with the QR code.
 * Works without client-side JavaScript, so the first step of the mandatory setup can't get stuck.
 */
export async function POST(request: Request) {
  const back = (path: string) => new Response(null, { status: 303, headers: { Location: path } });
  // Same-origin only: the session cookie is SameSite=Strict, this guards older browsers too.
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (origin && host && new URL(origin).host !== host) return new Response("Forbidden", { status: 403 });

  const context = await currentAdmin();
  if (!context) return back("/admin/login");
  const { admin } = context;
  if (!admin.totpEnabled) {
    await db.update(schema.adminUsers).set({ totpSecret: sealSecret(newTotpSecret()), totpLastStep: null }).where(eq(schema.adminUsers.id, admin.id));
  }
  return back("/admin/account#two-factor");
}
