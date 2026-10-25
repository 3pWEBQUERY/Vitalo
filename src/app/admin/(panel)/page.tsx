import Link from "next/link";
import { and, count, desc, eq, gte, isNull, sql, sum } from "drizzle-orm";
import { db, schema } from "@/db";
import { canAccess, requireAdmin } from "@/lib/admin";
import { number, percent, relative, usd } from "@/lib/format";
import { actionLabel } from "./audit/labels";

export const dynamic = "force-dynamic";

const day = () => new Date(Date.now() - 24 * 60 * 60_000);
const week = () => new Date(Date.now() - 7 * 24 * 60 * 60_000);
const monthStart = () => new Date(new Date().getFullYear(), new Date().getMonth(), 1);

export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const admin = await requireAdmin("overview");
  const { denied } = await searchParams;

  const [[users], [newUsers], [plus], [posts], [reports], [held], [appeals], [suspect], [revisions], [ai], [aiMonth]] = await Promise.all([
    db.select({ n: count() }).from(schema.users).where(isNull(schema.users.deletedAt)),
    db.select({ n: count() }).from(schema.users).where(and(isNull(schema.users.deletedAt), gte(schema.users.createdAt, week()))),
    db.select({ n: count() }).from(schema.users).where(and(isNull(schema.users.deletedAt), eq(schema.users.plan, "plus"))),
    db.select({ n: count() }).from(schema.posts).where(and(isNull(schema.posts.deletedAt), gte(schema.posts.createdAt, day()))),
    db.select({ n: count() }).from(schema.reports).where(eq(schema.reports.status, "open")),
    db.select({ n: count() }).from(schema.posts).where(and(eq(schema.posts.status, "held"), isNull(schema.posts.deletedAt))),
    db.select({ n: count() }).from(schema.appeals).where(eq(schema.appeals.status, "open")),
    db.select({ n: count() }).from(schema.foods).where(eq(schema.foods.quality, "suspect")),
    db.select({ n: count() }).from(schema.foodRevisions).where(eq(schema.foodRevisions.status, "pending")),
    db
      .select({ n: count(), errors: sql<number>`count(*) filter (where ${schema.aiRequests.status} <> 'ok')::int` })
      .from(schema.aiRequests)
      .where(gte(schema.aiRequests.createdAt, day())),
    db.select({ cost: sum(schema.aiRequests.costUsd) }).from(schema.aiRequests).where(gte(schema.aiRequests.createdAt, monthStart())),
  ]);
  const recent = canAccess(admin.role, "audit")
    ? await db
        .select({ entry: schema.auditLog, name: schema.adminUsers.name })
        .from(schema.auditLog)
        .leftJoin(schema.adminUsers, eq(schema.adminUsers.id, schema.auditLog.adminId))
        .orderBy(desc(schema.auditLog.createdAt))
        .limit(8)
    : [];

  const tasks = [
    { area: "moderation", href: "/admin/moderation", label: "Offene Meldungen", value: reports.n },
    { area: "moderation", href: "/admin/moderation?tab=held", label: "Zurückgehaltene Beiträge", value: held.n },
    { area: "moderation", href: "/admin/moderation?tab=appeals", label: "Einsprüche", value: appeals.n },
    { area: "foods", href: "/admin/foods?quality=suspect", label: "Verdächtige Lebensmittel", value: suspect.n },
    { area: "foods", href: "/admin/foods?tab=revisions", label: "Offene Korrekturen", value: revisions.n },
  ] as const;

  return (
    <main className="page">
      <div className="header">
        <div>
          <h1>Guten Tag, {admin.name.split(" ")[0]}</h1>
          <p>Was heute ansteht und wie es Vitalo geht.</p>
        </div>
      </div>
      {denied && <div className="alert" role="alert">Für diesen Bereich fehlt dir die Berechtigung.</div>}

      <h2 className="section-title">Zu erledigen</h2>
      <div className="card list">
        {tasks.filter((t) => canAccess(admin.role, t.area)).map((task) => (
          <Link key={task.href} href={task.href} className="list-row">
            <span>{task.label}</span>
            <span className={task.value ? "count attention" : "count"}>{number(task.value)}</span>
            <span className="chevron" aria-hidden>›</span>
          </Link>
        ))}
      </div>

      <h2 className="section-title">Kennzahlen</h2>
      <div className="stats">
        <div className="stat"><span>Konten</span><strong>{number(users.n)}</strong><small>+{number(newUsers.n)} in 7 Tagen</small></div>
        <div className="stat"><span>Vitalo Plus</span><strong>{number(plus.n)}</strong><small>{users.n ? percent(plus.n / users.n) : "–"} der Konten</small></div>
        <div className="stat"><span>Beiträge (24 h)</span><strong>{number(posts.n)}</strong><small>Community</small></div>
        {canAccess(admin.role, "ai") && (
          <div className="stat">
            <span>KI-Anfragen (24 h)</span><strong>{number(ai.n)}</strong>
            <small>{ai.n ? `${percent(ai.errors / ai.n)} Fehler` : "keine Fehler"} · {usd(Number(aiMonth.cost ?? 0))} im Monat</small>
          </div>
        )}
      </div>

      {recent.length > 0 && (
        <>
          <h2 className="section-title">Letzte Änderungen</h2>
          <div className="card list">
            {recent.map(({ entry, name }) => (
              <div key={entry.id} className="list-row static">
                <span><strong>{name ?? "System"}</strong> <span className="sub">{actionLabel(entry.action)}</span></span>
                <span className="sub">{relative(entry.createdAt)}</span>
              </div>
            ))}
            <Link href="/admin/audit" className="list-row more">Gesamtes Protokoll<span className="chevron" aria-hidden>›</span></Link>
          </div>
        </>
      )}
    </main>
  );
}
