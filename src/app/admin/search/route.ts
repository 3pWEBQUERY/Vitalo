import { desc, eq, ilike, or, sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db, schema } from "@/db";
import { canAccess, currentAdmin } from "@/lib/admin";

export type SearchHit = { group: string; label: string; detail?: string; href: string };

/** Global search for the command palette. Each group is only searched when the role may open it. */
export async function GET(request: NextRequest) {
  const context = await currentAdmin();
  if (!context) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const role = context.admin.role;
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return NextResponse.json({ hits: [] });
  const like = `%${q.replace(/^@/, "")}%`;
  const hits: SearchHit[] = [];

  if (canAccess(role, "users")) {
    const users = await db
      .select({ id: schema.users.id, email: schema.users.email, handle: schema.communityProfiles.handle, plan: schema.users.plan })
      .from(schema.users)
      .leftJoin(schema.communityProfiles, eq(schema.communityProfiles.userId, schema.users.id))
      .where(or(ilike(schema.communityProfiles.handle, like), ilike(schema.users.email, like), sql`${schema.users.id}::text like ${q + "%"}`))
      .limit(5);
    for (const u of users) hits.push({ group: "Nutzer", label: u.handle ? `@${u.handle}` : u.id.slice(0, 8), detail: [u.email, u.plan === "plus" ? "Plus" : "Free"].filter(Boolean).join(" · "), href: `/admin/users/${u.id}` });
  }
  if (canAccess(role, "foods")) {
    const foods = await db
      .select({ id: schema.foods.id, name: schema.foods.name, brand: schema.foods.brand, barcode: schema.foods.barcode })
      .from(schema.foods)
      .where(or(ilike(schema.foods.name, like), ilike(schema.foods.brand, like), eq(schema.foods.barcode, q)))
      .orderBy(desc(schema.foods.updatedAt))
      .limit(6);
    for (const f of foods) hits.push({ group: "Lebensmittel", label: f.name, detail: [f.brand, f.barcode].filter(Boolean).join(" · "), href: `/admin/foods/${f.id}` });
  }
  if (canAccess(role, "brands")) {
    const brands = await db.select({ id: schema.brands.id, name: schema.brands.name, domain: schema.brands.domain }).from(schema.brands).where(or(ilike(schema.brands.name, like), ilike(schema.brands.domain, like))).limit(5);
    for (const b of brands) hits.push({ group: "Marken", label: b.name, detail: b.domain ?? undefined, href: `/admin/brands/${b.id}` });
  }
  if (canAccess(role, "moderation")) {
    const groups = await db.select({ id: schema.communityGroups.id, name: schema.communityGroups.name }).from(schema.communityGroups).where(ilike(schema.communityGroups.name, like)).limit(4);
    for (const g of groups) hits.push({ group: "Gruppen", label: g.name, href: `/admin/community/groups/${g.id}` });
    const posts = await db.select({ id: schema.posts.id, body: schema.posts.body }).from(schema.posts).where(ilike(schema.posts.body, like)).orderBy(desc(schema.posts.createdAt)).limit(4);
    for (const p of posts) hits.push({ group: "Beiträge", label: (p.body ?? "").slice(0, 70), href: `/admin/community/posts/${p.id}` });
  }
  return NextResponse.json({ hits });
}
