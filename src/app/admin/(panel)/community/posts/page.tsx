import Link from "next/link";
import { and, count, desc, eq, ilike, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { Icon } from "@/components/Icon";
import { requireAdmin } from "@/lib/admin";
import { number, relative } from "@/lib/format";
import { BulkTable, Flash } from "../../../components/ui";
import { bulkPostAction } from "../actions";
import { POST_KINDS, POST_STATUS } from "../labels";

export const dynamic = "force-dynamic";

const PAGE = 50;
type Params = { q?: string; status?: string; kind?: string; group?: string; page?: string; deleted?: string };

export default async function PostsPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireAdmin("moderation");
  const params = await searchParams;
  const { q = "", status = "", kind = "", group = "", deleted } = params;
  const page = Math.max(1, Number(params.page) || 1);
  const term = q.trim().replace(/^@/, "");

  const filters: SQL[] = [];
  if (status === "deleted") filters.push(isNotNull(schema.posts.deletedAt));
  else {
    filters.push(isNull(schema.posts.deletedAt));
    if (status in POST_STATUS) filters.push(eq(schema.posts.status, status as keyof typeof POST_STATUS));
  }
  if (/^[0-9a-f-]{36}$/i.test(group)) filters.push(eq(schema.posts.groupId, group));
  if (kind in POST_KINDS) filters.push(eq(schema.posts.kind, kind as keyof typeof POST_KINDS));
  if (term) filters.push(or(ilike(schema.posts.body, `%${term}%`), ilike(schema.communityProfiles.handle, `%${term}%`))!);
  const where = and(...filters);

  const statusCounts = await db
    .select({ status: schema.posts.status, deleted: sql<boolean>`${schema.posts.deletedAt} is not null`, n: count() })
    .from(schema.posts)
    .groupBy(schema.posts.status, sql`${schema.posts.deletedAt} is not null`);
  const tally = (s?: string, del = false) => statusCounts.filter((c) => c.deleted === del && (!s || c.status === s)).reduce((sum, c) => sum + c.n, 0);

  const [total] = await db.select({ n: count() }).from(schema.posts).leftJoin(schema.communityProfiles, eq(schema.communityProfiles.userId, schema.posts.userId)).where(where);
  const rows = await db
    .select({
      post: schema.posts,
      handle: schema.communityProfiles.handle,
      group: schema.communityGroups.name,
      reports: sql<number>`(select count(*)::int from reports r where r.target_type = 'post' and r.target_id = ${schema.posts.id} and r.status = 'open')`,
    })
    .from(schema.posts)
    .leftJoin(schema.communityProfiles, eq(schema.communityProfiles.userId, schema.posts.userId))
    .leftJoin(schema.communityGroups, eq(schema.communityGroups.id, schema.posts.groupId))
    .where(where)
    .orderBy(desc(schema.posts.createdAt))
    .limit(PAGE)
    .offset((page - 1) * PAGE);

  const link = (changes: Partial<Params>) => {
    const merged = { q: term || undefined, status: status || undefined, kind: kind || undefined, group: group || undefined, ...changes };
    const qs = new URLSearchParams(Object.entries(merged).filter(([, v]) => v) as [string, string][]).toString();
    return qs ? `?${qs}` : "?";
  };
  const tabs = [
    ["", "Alle", tally()],
    ["published", "Veröffentlicht", tally("published")],
    ["held", "Zurückgehalten", tally("held")],
    ["removed", "Ausgeblendet", tally("removed")],
    ["deleted", "Gelöscht", tally(undefined, true)],
  ] as const;
  const from = (page - 1) * PAGE + 1;
  const to = Math.min(page * PAGE, total.n);

  return (
    <main className="page">
      <Flash message={deleted ? "Beitrag gelöscht." : null} />
      <div className="header">
        <div>
          <h1>Beiträge</h1>
          <p>Alle Beiträge der Community. Ausblenden entfernt einen Beitrag aus allen Feeds, Löschen entfernt ihn endgültig.</p>
        </div>
      </div>

      <div className="segmented" role="tablist">
        {tabs.map(([key, label, n]) => (
          <Link key={key} href={link({ status: key || undefined, page: undefined })} aria-current={status === key ? "page" : undefined}>{label}<span className="count-inline">{number(n)}</span></Link>
        ))}
      </div>

      <form className="toolbar" role="search">
        {status && <input type="hidden" name="status" value={status} />}
        {group && <input type="hidden" name="group" value={group} />}
        <input type="search" name="q" defaultValue={q} placeholder="Text oder @Name" aria-label="Beiträge suchen" className="grow" />
        <select name="kind" defaultValue={kind} aria-label="Art">
          <option value="">Alle Arten</option>
          {Object.entries(POST_KINDS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        <button type="submit" className="btn secondary"><Icon name="filter" size={15} />Filtern</button>
      </form>

      <BulkTable
        action={bulkPostAction}
        noun={["Beitrag", "Beiträge"]}
        options={[
          { value: "hide", label: "Ausblenden" },
          { value: "restore", label: "Wiederherstellen" },
          { value: "delete", label: "Endgültig löschen", destructive: true },
        ]}
      >
        <div className="table-wrap">
          {rows.length === 0 ? (
            <div className="empty-state"><Icon name="message" size={28} /><strong>Keine Beiträge</strong><span>{term ? `Nichts gefunden für „${q}“.` : "Sobald jemand in der Community postet, erscheint es hier."}</span></div>
          ) : (
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th className="col-check"><input type="checkbox" data-select-all aria-label="Alle auswählen" /></th>
                    <th>Beitrag</th>
                    <th className="hide-sm">Von</th>
                    <th className="hide-sm">Art</th>
                    <th className="col-num hide-sm">Reaktionen</th>
                    <th>Status</th>
                    <th className="hide-sm">Erstellt</th>
                    <th className="col-actions" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ post, handle, group, reports }) => {
                    const [label, cls] = post.deletedAt ? ["Gelöscht", "tag"] : POST_STATUS[post.status];
                    return (
                      <tr key={post.id}>
                        <td className="col-check"><input type="checkbox" name="ids" value={post.id} aria-label="Beitrag auswählen" /></td>
                        <td>
                          <div className="cell-text">
                            <Link href={`/admin/community/posts/${post.id}`} className="row-link clamp">{post.body || "(ohne Text)"}</Link>
                            <span className="sub">{group ? `in ${group} · ` : ""}{post.commentCount} Kommentare{reports ? ` · ${reports} offene Meldungen` : ""}</span>
                          </div>
                        </td>
                        <td className="hide-sm">{handle ? <Link href={`/admin/users/${post.userId}`}>@{handle}</Link> : <span className="sub">unbekannt</span>}</td>
                        <td className="sub hide-sm">{POST_KINDS[post.kind]}</td>
                        <td className="col-num hide-sm">{post.reactionCount}</td>
                        <td><span className={cls}>{label}</span></td>
                        <td className="sub hide-sm nowrap">{relative(post.createdAt)}</td>
                        <td className="col-actions"><Link href={`/admin/community/posts/${post.id}`} className="btn icon-btn" aria-label="Beitrag öffnen"><Icon name="chevronRight" size={16} /></Link></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </BulkTable>
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
