import Link from "next/link";
import { and, desc, eq, ilike, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { Icon } from "@/components/Icon";
import { requireAdmin } from "@/lib/admin";
import { date, number } from "@/lib/format";
import { Flash } from "../../../components/ui";
import { GROUP_STATUS, VISIBILITY } from "../labels";

export const dynamic = "force-dynamic";

export default async function GroupsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; deleted?: string }> }) {
  await requireAdmin("moderation");
  const { q = "", status = "", deleted } = await searchParams;
  const filters: SQL[] = [];
  if (q.trim()) filters.push(ilike(schema.communityGroups.name, `%${q.trim()}%`));
  if (status in GROUP_STATUS) filters.push(eq(schema.communityGroups.status, status as keyof typeof GROUP_STATUS));
  const rows = await db
    .select({
      group: schema.communityGroups,
      owner: schema.communityProfiles.handle,
      members: sql<number>`(select count(*)::int from group_members m where m.group_id = ${schema.communityGroups.id} and m.status = 'active')`,
      requests: sql<number>`(select count(*)::int from group_members m where m.group_id = ${schema.communityGroups.id} and m.status = 'requested')`,
      posts: sql<number>`(select count(*)::int from posts p where p.group_id = ${schema.communityGroups.id} and p.deleted_at is null)`,
    })
    .from(schema.communityGroups)
    .leftJoin(schema.communityProfiles, eq(schema.communityProfiles.userId, schema.communityGroups.ownerId))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(schema.communityGroups.createdAt))
    .limit(200);

  return (
    <main className="page">
      <Flash message={deleted ? "Gruppe gelöscht." : null} />
      <div className="header">
        <div>
          <h1>Gruppen</h1>
          <p>Gruppen der Community: Angaben und Regeln bearbeiten, Mitglieder verwalten, sperren oder löschen.</p>
        </div>
      </div>
      <form className="toolbar" role="search">
        <input type="search" name="q" defaultValue={q} placeholder="Gruppenname" aria-label="Gruppen suchen" className="grow" />
        <select name="status" defaultValue={status} aria-label="Status">
          <option value="">Alle Status</option>
          {Object.entries(GROUP_STATUS).map(([key, [label]]) => <option key={key} value={key}>{label}</option>)}
        </select>
        <button type="submit" className="btn secondary"><Icon name="filter" size={15} />Filtern</button>
      </form>
      <div className="table-wrap">
        {rows.length === 0 ? (
          <div className="empty-state"><Icon name="people" size={28} /><strong>Keine Gruppen</strong><span>Gruppen entstehen in der App, wenn jemand eine gründet.</span></div>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead><tr><th>Gruppe</th><th className="hide-sm">Gegründet von</th><th>Sichtbarkeit</th><th className="col-num">Mitglieder</th><th className="col-num hide-sm">Beiträge</th><th>Status</th><th className="hide-sm">Seit</th><th className="col-actions" /></tr></thead>
              <tbody>
                {rows.map(({ group, owner, members, requests, posts }) => (
                  <tr key={group.id}>
                    <td><div className="cell-text"><Link href={`/admin/community/groups/${group.id}`} className="row-link">{group.name}</Link><span className="sub">{group.description ?? "Keine Beschreibung"}</span></div></td>
                    <td className="hide-sm">{owner ? <Link href={`/admin/users/${group.ownerId}`}>@{owner}</Link> : "–"}</td>
                    <td className="sub">{VISIBILITY[group.visibility]}</td>
                    <td className="col-num">{number(members)}{requests ? <span className="sub"> +{requests}</span> : null}</td>
                    <td className="col-num hide-sm">{number(posts)}</td>
                    <td><span className={GROUP_STATUS[group.status][1]}>{GROUP_STATUS[group.status][0]}</span></td>
                    <td className="sub hide-sm nowrap">{date(group.createdAt)}</td>
                    <td className="col-actions"><Link href={`/admin/community/groups/${group.id}`} className="btn icon-btn" aria-label={`${group.name} bearbeiten`}><Icon name="edit" size={16} /></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
