import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { Icon } from "@/components/Icon";
import { requireAdmin, ROLE_NAMES, ROLE_TEXT, ROLES } from "@/lib/admin";
import { dateTime, relative } from "@/lib/format";
import { ActionForm, Flash, StateForm, SubmitButton } from "../../../components/ui";
import { actionLabel } from "../../audit/labels";
import { deleteMemberAction, memberStatusAction, setPasswordAction, updateMemberAction } from "../actions";

export const dynamic = "force-dynamic";

function Op({ id, op, label, icon, danger, confirm }: { id: string; op: string; label: string; icon: Parameters<typeof SubmitButton>[0]["icon"]; danger?: boolean; confirm?: string }) {
  return (
    <ActionForm action={memberStatusAction} confirm={confirm ? { title: confirm, confirmLabel: label, tone: danger ? "danger" : "default" } : undefined}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="op" value={op} />
      <SubmitButton className={`btn ${danger ? "danger" : "secondary"}`} icon={icon}>{label}</SubmitButton>
    </ActionForm>
  );
}

export default async function MemberPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const me = await requireAdmin("team");
  const { id } = await params;
  const { created } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [member] = await db.select().from(schema.adminUsers).where(eq(schema.adminUsers.id, id));
  if (!member) notFound();
  const [sessions, activity] = await Promise.all([
    db.select().from(schema.adminSessions).where(eq(schema.adminSessions.adminId, id)).orderBy(desc(schema.adminSessions.lastSeenAt)),
    db.select().from(schema.auditLog).where(eq(schema.auditLog.adminId, id)).orderBy(desc(schema.auditLog.id)).limit(12),
  ]);
  const self = member.id === me.id;
  const locked = member.lockedUntil && member.lockedUntil > new Date();

  return (
    <main className="page">
      <Flash message={created ? "Konto angelegt." : null} />
      <Link href="/admin/team" className="back"><Icon name="chevronRight" size={14} className="flip" />Team</Link>
      <div className="header">
        <div className="title-with-icon">
          <span className="avatar lg" aria-hidden>{member.name.slice(0, 1).toUpperCase()}</span>
          <div>
            <h1>{member.name}{self ? " (du)" : ""}</h1>
            <p className="meta-line">
              <span>{ROLE_NAMES[member.role]}</span>
              <span>{member.email}</span>
              {member.disabledAt ? <span className="tag">Deaktiviert</span> : locked ? <span className="tag danger">Gesperrt</span> : <span className="tag ok">Aktiv</span>}
            </p>
          </div>
        </div>
      </div>

      <div className="detail-grid">
        <div className="stack">
          <StateForm action={updateMemberAction} className="card form-section">
            <input type="hidden" name="id" value={member.id} />
            <div className="form-section-head"><h2>Angaben</h2></div>
            <div className="grid-2">
              <label className="field"><span>Name</span><input type="text" name="name" defaultValue={member.name} required minLength={2} maxLength={80} /></label>
              <label className="field"><span>E-Mail-Adresse</span><input type="email" name="email" defaultValue={member.email} required /></label>
            </div>
            <fieldset className="role-picker" disabled={self}>
              <legend className="field-label">Rolle{self ? " (die eigene Rolle ändert eine andere Person)" : ""}</legend>
              {ROLES.map((role) => (
                <label key={role} className="role-option">
                  <input type="radio" name="role" value={role} defaultChecked={member.role === role} />
                  <span><strong>{ROLE_NAMES[role]}</strong><small>{ROLE_TEXT[role]}</small></span>
                </label>
              ))}
            </fieldset>
            {self && <input type="hidden" name="role" value={member.role} />}
            <div className="form-actions"><SubmitButton className="btn primary" icon="check">Speichern</SubmitButton></div>
          </StateForm>

          {!self && (
            <StateForm action={setPasswordAction} className="card form-section" resetOnSuccess>
              <input type="hidden" name="id" value={member.id} />
              <div className="form-section-head"><h2>Neues Passwort setzen</h2><p>Für vergessene Passwörter. Alle Sitzungen der Person enden.</p></div>
              <input type="text" name="username" autoComplete="username" defaultValue={member.email} hidden readOnly />
              <div className="inline-field">
                <input type="password" name="password" autoComplete="new-password" minLength={12} required placeholder="Mindestens 12 Zeichen" aria-label="Neues Passwort" />
                <SubmitButton className="btn secondary" icon="key">Passwort setzen</SubmitButton>
              </div>
            </StateForm>
          )}

          <section className="card">
            <div className="card-head"><h2>Letzte Aktivität</h2><Link href={`/admin/audit`} className="sub">Protokoll</Link></div>
            {activity.length === 0 ? <div className="empty-state"><span>Noch keine Aktivität.</span></div> : (
              <ul className="plain-list card-body">
                {activity.map((a) => <li key={a.id}><span className="grow-text">{actionLabel(a.action)}</span><span className="sub">{relative(a.createdAt)}</span></li>)}
              </ul>
            )}
          </section>
        </div>

        <aside className="detail-side">
          <section className="card">
            <div className="card-head"><h2>Sicherheit</h2></div>
            <dl className="card-body facts single">
              <div><dt>Zwei-Faktor</dt><dd>{member.totpEnabled ? "Aktiv" : "Nicht eingerichtet"}</dd></div>
              <div><dt>Letzte Anmeldung</dt><dd>{member.lastLoginAt ? relative(member.lastLoginAt) : "nie"}</dd></div>
              <div><dt>Offene Sitzungen</dt><dd>{sessions.length}</dd></div>
              <div><dt>Fehlversuche</dt><dd>{member.failedLogins}</dd></div>
              <div><dt>Angelegt</dt><dd>{dateTime(member.createdAt)}</dd></div>
            </dl>
            <div className="card-body stack-tight side-actions">
              {sessions.length > 0 && <Op id={member.id} op="end_sessions" label="Alle Sitzungen beenden" icon="logout" />}
              {!self && member.totpEnabled && <Op id={member.id} op="reset_2fa" label="Zwei-Faktor zurücksetzen" icon="key" confirm={`Zwei-Faktor-Anmeldung von ${member.name} zurücksetzen? Die Person richtet sie bei der nächsten Anmeldung neu ein.`} />}
              {!self && locked && <Op id={member.id} op="unlock" label="Sperre aufheben" icon="undo" />}
            </div>
          </section>
          {!self && (
            <section className="card danger-zone">
              <div className="card-head"><h2>Zugang</h2></div>
              <div className="card-body stack-tight side-actions">
                {member.disabledAt
                  ? <Op id={member.id} op="enable" label="Reaktivieren" icon="undo" />
                  : <Op id={member.id} op="disable" label="Deaktivieren" icon="ban" danger confirm={`Zugang von ${member.name} sofort beenden?`} />}
                <ActionForm action={deleteMemberAction} confirm={{ title: `${member.name} aus dem Team entfernen?`, text: "Das Konto wird gelöscht. Einträge im Protokoll bleiben erhalten.", confirmLabel: "Entfernen", tone: "danger" }}>
                  <input type="hidden" name="id" value={member.id} />
                  <SubmitButton className="btn danger" icon="trash">Konto löschen</SubmitButton>
                </ActionForm>
              </div>
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}
