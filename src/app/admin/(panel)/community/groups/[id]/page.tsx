import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { Icon } from "@/components/Icon";
import { requireAdmin } from "@/lib/admin";
import { date, relative } from "@/lib/format";
import { ActionForm, SubmitButton } from "../../../../components/ui";
import { deleteGroupAction, memberAction, saveGroupAction } from "../../actions";
import { CHALLENGE_KINDS, challengePhase, GROUP_ROLES, GROUP_STATUS, VISIBILITY } from "../../labels";

export const dynamic = "force-dynamic";

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin("moderation");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [group] = await db.select().from(schema.communityGroups).where(eq(schema.communityGroups.id, id));
  if (!group) notFound();
  const [members, challenges, [owner]] = await Promise.all([
    db
      .select({ member: schema.groupMembers, handle: schema.communityProfiles.handle })
      .from(schema.groupMembers)
      .leftJoin(schema.communityProfiles, eq(schema.communityProfiles.userId, schema.groupMembers.userId))
      .where(eq(schema.groupMembers.groupId, id))
      .orderBy(sql`case ${schema.groupMembers.role} when 'admin' then 0 when 'moderator' then 1 else 2 end`, desc(schema.groupMembers.createdAt)),
    db.select().from(schema.challenges).where(eq(schema.challenges.groupId, id)).orderBy(desc(schema.challenges.startsOn)),
    db.select({ handle: schema.communityProfiles.handle }).from(schema.communityProfiles).where(eq(schema.communityProfiles.userId, group.ownerId)),
  ]);

  return (
    <main className="page">
      <Link href="/admin/community/groups" className="back"><Icon name="chevronRight" size={14} className="flip" />Gruppen</Link>
      <div className="header">
        <div>
          <h1>{group.name}</h1>
          <p className="meta-line">
            <span className={GROUP_STATUS[group.status][1]}>{GROUP_STATUS[group.status][0]}</span>
            <span>{VISIBILITY[group.visibility]}</span>
            <span>gegründet {date(group.createdAt)}{owner ? ` von @${owner.handle}` : ""}</span>
          </p>
        </div>
        <Link href={`/admin/community/posts?group=${group.id}`} className="btn secondary"><Icon name="message" size={16} />Beiträge der Gruppe</Link>
      </div>

      <div className="detail-grid">
        <div className="stack">
          <ActionForm action={saveGroupAction} className="card form-section">
            <input type="hidden" name="id" value={group.id} />
            <div className="form-section-head"><h2>Angaben</h2><p>Änderungen sind sofort in der App sichtbar.</p></div>
            <label className="field"><span>Name</span><input type="text" name="name" defaultValue={group.name} required minLength={3} maxLength={60} /></label>
            <label className="field"><span>Beschreibung</span><textarea name="description" defaultValue={group.description ?? ""} maxLength={500} rows={3} /></label>
            <label className="field"><span>Regeln</span><textarea name="rules" defaultValue={group.rules ?? ""} maxLength={2000} rows={4} /></label>
            <div className="grid-2">
              <label className="field">
                <span>Sichtbarkeit</span>
                <select name="visibility" defaultValue={group.visibility}>
                  <option value="public">Öffentlich: jede Person kann beitreten</option>
                  <option value="private">Privat: Beitritt auf Anfrage</option>
                  <option value="invite">Nur auf Einladung</option>
                </select>
              </label>
              <label className="field">
                <span>Status</span>
                <select name="status" defaultValue={group.status}>
                  <option value="active">Aktiv</option>
                  <option value="suspended">Gesperrt (unsichtbar, Daten bleiben)</option>
                  <option value="removed">Entfernt</option>
                </select>
              </label>
            </div>
            <div className="form-actions"><SubmitButton className="btn primary" icon="check">Speichern</SubmitButton></div>
          </ActionForm>

          <section className="card">
            <div className="card-head"><h2>Mitglieder</h2><span className="sub">{members.length}</span></div>
            {members.length === 0 ? <div className="empty-state"><span>Keine Mitglieder.</span></div> : (
              <table className="table">
                <thead><tr><th>Person</th><th>Rolle</th><th className="hide-sm">Seit</th><th className="col-actions" /></tr></thead>
                <tbody>
                  {members.map(({ member, handle }) => (
                    <tr key={member.userId}>
                      <td>{handle ? <Link href={`/admin/users/${member.userId}`} className="row-link">@{handle}</Link> : <span className="sub">ohne Profil</span>} {member.status !== "active" && <span className="tag warn">{member.status === "requested" ? "Anfrage" : "Eingeladen"}</span>}</td>
                      <td>
                        <ActionForm action={memberAction} className="inline-select">
                          <input type="hidden" name="groupId" value={group.id} />
                          <input type="hidden" name="userId" value={member.userId} />
                          <select name="op" defaultValue={member.role} aria-label="Rolle">
                            {Object.entries(GROUP_ROLES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                          </select>
                          <SubmitButton className="btn secondary small">Ändern</SubmitButton>
                        </ActionForm>
                      </td>
                      <td className="sub hide-sm">{relative(member.createdAt)}</td>
                      <td className="col-actions">
                        <div className="row-actions">
                          {member.status === "requested" && (
                            <ActionForm action={memberAction}><input type="hidden" name="groupId" value={group.id} /><input type="hidden" name="userId" value={member.userId} /><input type="hidden" name="op" value="approve" /><SubmitButton className="btn secondary small">Bestätigen</SubmitButton></ActionForm>
                          )}
                          <ActionForm action={memberAction} confirm={{ title: `${handle ? `@${handle}` : "Person"} aus der Gruppe entfernen?`, confirmLabel: "Entfernen", tone: "danger" }}>
                            <input type="hidden" name="groupId" value={group.id} /><input type="hidden" name="userId" value={member.userId} /><input type="hidden" name="op" value="remove" />
                            <SubmitButton className="btn icon-btn danger" title="Entfernen"><Icon name="x" size={16} /></SubmitButton>
                          </ActionForm>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>

        <aside className="detail-side">
          <section className="card">
            <div className="card-head"><h2>Challenges der Gruppe</h2></div>
            <div className="card-body">
              {challenges.length === 0 ? <p className="sub">Keine Challenges.</p> : (
                <ul className="plain-list">
                  {challenges.map((c) => {
                    const [phase, cls] = challengePhase(c.startsOn, c.endsOn);
                    return <li key={c.id}><Link href={`/admin/community/challenges/${c.id}`} className="name grow-text">{c.title}</Link><span className={cls}>{phase}</span><span className="sub full">{CHALLENGE_KINDS[c.kind]} · {date(c.startsOn)} – {date(c.endsOn)}</span></li>;
                  })}
                </ul>
              )}
            </div>
          </section>
          <section className="card danger-zone">
            <div className="card-head"><h2>Gruppe löschen</h2></div>
            <div className="card-body stack-tight">
              <p className="sub">Mitgliedschaften, Gruppenbeiträge und Challenges werden mit gelöscht. Zum Ausblenden reicht der Status „Gesperrt“.</p>
              <ActionForm action={deleteGroupAction} confirm={{ title: `„${group.name}“ löschen?`, text: "Alle Mitgliedschaften, Beiträge und Challenges der Gruppe werden gelöscht. Das lässt sich nicht rückgängig machen.", confirmLabel: "Gruppe löschen", tone: "danger" }}>
                <input type="hidden" name="id" value={group.id} />
                <SubmitButton className="btn danger" icon="trash">Gruppe löschen</SubmitButton>
              </ActionForm>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
