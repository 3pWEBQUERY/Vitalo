import Link from "next/link";
import { and, count, desc, eq, ilike, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { Icon } from "@/components/Icon";
import { requireAdmin } from "@/lib/admin";
import { date, number, relative, shortId } from "@/lib/format";
import { Flash } from "../../components/ui";

export const dynamic = "force-dynamic";

const PAGE = 50;
type Params = { q?: string; plan?: string; status?: string; page?: string; deleted?: string };

export default async function UsersPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireAdmin("users");
  const params = await searchParams;
  const { q = "", plan = "", status = "", deleted } = params;
  const page = Math.max(1, Number(params.page) || 1);
  const term = q.trim().replace(/^@/, "");
  const isId = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(term);

  const filters: SQL[] = [isNull(schema.users.deletedAt)];
  if (term) filters.push(isId ? eq(schema.users.id, term) : or(ilike(schema.communityProfiles.handle, `%${term}%`), ilike(schema.users.email, `%${term}%`), sql`${schema.users.id}::text like ${term + "%"}`)!);
  if (plan === "plus" || plan === "free") filters.push(eq(schema.users.plan, plan));
  if (status === "locked") filters.push(isNotNull(schema.users.lockedAt));
  if (status === "community") filters.push(isNotNull(schema.communityProfiles.handle));
  const where = and(...filters);

  const [[total], [all], [plus], [locked], [week]] = await Promise.all([
    db.select({ n: count() }).from(schema.users).leftJoin(schema.communityProfiles, eq(schema.communityProfiles.userId, schema.users.id)).where(where),
    db.select({ n: count() }).from(schema.users).where(isNull(schema.users.deletedAt)),
    db.select({ n: count() }).from(schema.users).where(and(isNull(schema.users.deletedAt), eq(schema.users.plan, "plus"))),
    db.select({ n: count() }).from(schema.users).where(and(isNull(schema.users.deletedAt), isNotNull(schema.users.lockedAt))),
    db.select({ n: count() }).from(schema.users).where(and(isNull(schema.users.deletedAt), sql`${schema.users.createdAt} > now() - interval '7 days'`)),
  ]);
  const rows = await db
    .select({
      user: schema.users,
      handle: schema.communityProfiles.handle,
      devices: sql<number>`(select count(*)::int from device_sessions s where s.user_id = ${schema.users.id} and s.revoked_at is null)`,
      lastSeen: sql<Date | null>`(select max(last_used_at) from device_sessions s where s.user_id = ${schema.users.id})`,
    })
    .from(schema.users)
    .leftJoin(schema.communityProfiles, eq(schema.communityProfiles.userId, schema.users.id))
    .where(where)
    .orderBy(desc(schema.users.createdAt))
    .limit(PAGE)
    .offset((page - 1) * PAGE);

  const link = (changes: Partial<Params>) => {
    const merged = { q: term || undefined, plan: plan || undefined, status: status || undefined, ...changes };
    const qs = new URLSearchParams(Object.entries(merged).filter(([, v]) => v) as [string, string][]).toString();
    return qs ? `?${qs}` : "?";
  };
  const from = (page - 1) * PAGE + 1;
  const to = Math.min(page * PAGE, total.n);

  return (
    <main className="page">
      <Flash message={deleted ? "Konto gelöscht." : null} />
      <div className="header">
        <div>
          <h1>Nutzer</h1>
          <p>Konto, Plan, Geräte und Community-Status. Gesundheits- und Tagebuchdaten sind hier bewusst nicht sichtbar.</p>
        </div>
      </div>
      <div className="stats">
        <div className="stat"><span>Konten</span><strong>{number(all.n)}</strong><small>+{number(week.n)} in 7 Tagen</small></div>
        <div className="stat"><span>Vitalo Plus</span><strong>{number(plus.n)}</strong></div>
        <div className="stat"><span>Gesperrt</span><strong>{number(locked.n)}</strong></div>
      </div>
      <form className="toolbar" role="search">
        <input type="search" name="q" defaultValue={q} placeholder="Konto-ID, @Name oder E-Mail" aria-label="Nutzer suchen" className="grow" />
        <select name="plan" defaultValue={plan} aria-label="Plan"><option value="">Alle Pläne</option><option value="plus">Plus</option><option value="free">Free</option></select>
        <select name="status" defaultValue={status} aria-label="Status"><option value="">Alle</option><option value="community">In der Community</option><option value="locked">Gesperrt</option></select>
        <button type="submit" className="btn secondary"><Icon name="filter" size={15} />Filtern</button>
      </form>
      <div className="table-wrap">
        {rows.length === 0 ? (
          <div className="empty-state"><Icon name="person" size={28} /><strong>Kein Konto gefunden</strong><span>{term ? `Nichts passt zu „${q}“.` : "Noch keine Konten."}</span></div>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead><tr><th>Konto</th><th>Plan</th><th className="col-num hide-sm">Geräte</th><th className="hide-sm">Zuletzt aktiv</th><th className="hide-sm">Seit</th><th>Status</th><th className="col-actions" /></tr></thead>
              <tbody>
                {rows.map(({ user, handle, devices, lastSeen }) => (
                  <tr key={user.id}>
                    <td>
                      <div className="cell-main">
                        <span className="avatar" aria-hidden>{(handle ?? "#").slice(0, 1).toUpperCase()}</span>
                        <div className="cell-text">
                          <Link href={`/admin/users/${user.id}`} className="row-link">{handle ? `@${handle}` : <span className="mono">{shortId(user.id)}</span>}</Link>
                          <span className="sub">{user.email ?? (user.appleSub?.startsWith("dev:") ? "Testkonto" : "Sign in with Apple")}</span>
                        </div>
                      </div>
                    </td>
                    <td><span className={user.plan === "plus" ? "tag ok" : "tag"}>{user.plan === "plus" ? "Plus" : "Free"}</span></td>
                    <td className="col-num hide-sm">{devices}</td>
                    <td className="sub hide-sm nowrap">{lastSeen ? relative(new Date(lastSeen)) : "–"}</td>
                    <td className="sub hide-sm nowrap">{date(user.createdAt)}</td>
                    <td>{user.lockedAt ? <span className="tag danger">Gesperrt</span> : <span className="tag ok">Aktiv</span>}</td>
                    <td className="col-actions"><Link href={`/admin/users/${user.id}`} className="btn icon-btn" aria-label="Öffnen"><Icon name="chevronRight" size={16} /></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {total.n > 0 && (
        <div className="pager">
          <span>{number(from)}–{number(to)} von {number(total.n)}</span>
          <div className="pager-buttons">
            {page > 1 && <Link className="btn secondary small" href={link({ page: String(page - 1) })}>Zurück</Link>}
            {to < total.n && <Link className="btn secondary small" href={link({ page: String(page + 1) })}>Weiter</Link>}
          </div>
        </div>
      )}
    </main>
  );
}
