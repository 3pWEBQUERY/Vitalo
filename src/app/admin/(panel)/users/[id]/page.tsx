import Link from "next/link";
import { notFound } from "next/navigation";
import { and, count, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { Icon } from "@/components/Icon";
import { canAccess, requireAdmin } from "@/lib/admin";
import { latestConsents, sessionsOf } from "@/lib/account";
import { effectivePlan } from "@/lib/appstore";
import { date, dateTime, relative } from "@/lib/format";
import { SANCTION_NAMES, sanctionsOf } from "@/lib/moderation";
import { ActionForm, SubmitButton } from "../../../components/ui";
import { profileAction } from "../../community/actions";
import { liftSanctionAction } from "../../moderation/actions";
import { SanctionForm } from "../../moderation/SanctionForm";
import { deleteUserAction, grantPlusAction, lockAction, revokeSessionAction, revokeSessionsAction, unlockAction } from "../actions";

export const dynamic = "force-dynamic";

const CONSENT_NAMES: Record<string, string> = {
  healthData: "Gesundheitsdaten",
  aiProcessing: "KI-Verarbeitung",
  appleHealth: "Apple Health",
  notifications: "Mitteilungen",
  community: "Community",
  healthSync: "Synchronisierung",
};

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin("users");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id));
  if (!user) notFound();

  const [plan, sessions, consents, [community], [posts], sanctions, [subscription]] = await Promise.all([
    effectivePlan(id),
    sessionsOf(id),
    latestConsents(id),
    db.select().from(schema.communityProfiles).where(eq(schema.communityProfiles.userId, id)),
    db.select({ n: count() }).from(schema.posts).where(and(eq(schema.posts.userId, id), isNull(schema.posts.deletedAt))),
    sanctionsOf(id),
    db.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, id)),
  ]);
  const moderator = canAccess(admin.role, "moderation");
  const title = community ? `@${community.handle}` : "Konto";

  return (
    <main className="page">
      <Link href="/admin/users" className="back"><Icon name="chevronRight" size={14} className="flip" />Nutzer</Link>
      <div className="header">
        <div className="title-with-icon">
          <span className="avatar lg" aria-hidden>{(community?.handle ?? "#").slice(0, 1).toUpperCase()}</span>
          <div>
            <h1>{title}</h1>
            <p className="meta-line">
              {user.lockedAt ? <span className="tag danger">Gesperrt</span> : <span className="tag ok">Aktiv</span>}
              <span className={plan.plan === "plus" ? "tag ok" : "tag"}>{plan.plan === "plus" ? "Plus" : "Free"}</span>
              <span className="mono">{user.id}</span>
            </p>
          </div>
        </div>
        <div className="actions">
          <ActionForm action={revokeSessionsAction} confirm={{ title: "Auf allen Geräten abmelden?", text: "Die Person muss sich danach neu anmelden. Ihre Daten bleiben erhalten.", confirmLabel: "Abmelden" }}>
            <input type="hidden" name="userId" value={user.id} />
            <SubmitButton className="btn secondary" icon="logout">Überall abmelden</SubmitButton>
          </ActionForm>
          {user.lockedAt && (
            <ActionForm action={unlockAction}><input type="hidden" name="userId" value={user.id} /><SubmitButton className="btn primary" icon="undo">Entsperren</SubmitButton></ActionForm>
          )}
        </div>
      </div>

      {user.lockedAt && <div className="alert" role="alert"><Icon name="lock" size={16} />Gesperrt seit {dateTime(user.lockedAt)}: {user.lockReason}</div>}

      <div className="detail-grid">
        <div className="stack">
          <section className="card">
            <div className="card-head"><h2>Konto</h2></div>
            <div className="card-body stack-tight">
              <dl className="facts">
                <div><dt>Angemeldet mit</dt><dd>{user.appleSub?.startsWith("dev:") ? "Testkonto (Entwicklung)" : "Sign in with Apple"}</dd></div>
                <div><dt>E-Mail</dt><dd>{user.email ?? "nicht geteilt"}</dd></div>
                <div><dt>Erstellt</dt><dd>{dateTime(user.createdAt)}</dd></div>
                <div><dt>Plan</dt><dd>{plan.plan === "plus" ? "Vitalo Plus" : "Free"}{plan.status === "complimentary" ? " (vom Support)" : ""}{plan.expiresAt ? ` bis ${date(plan.expiresAt)}` : ""}</dd></div>
                {subscription && <div><dt>App-Store-Abo</dt><dd>{subscription.productId} · {subscription.status} · {subscription.environment}</dd></div>}
              </dl>
              {!subscription && (
                <ActionForm action={grantPlusAction} className="inline-field">
                  <input type="hidden" name="userId" value={user.id} />
                  <select name="days" defaultValue="30" aria-label="Dauer">
                    <option value="7">Plus für 7 Tage</option>
                    <option value="30">Plus für 30 Tage</option>
                    <option value="90">Plus für 90 Tage</option>
                    <option value="365">Plus für 1 Jahr</option>
                    <option value="0">Zurück auf Free</option>
                  </select>
                  <SubmitButton className="btn secondary" icon="sparkles">Plan setzen</SubmitButton>
                </ActionForm>
              )}
            </div>
          </section>

          <section className="card">
            <div className="card-head"><h2>Geräte</h2><span className="sub">{sessions.length}</span></div>
            {sessions.length === 0 ? <div className="empty-state"><span>Auf keinem Gerät angemeldet.</span></div> : (
              <table className="table">
                <thead><tr><th>Gerät</th><th>App-Version</th><th className="hide-sm">Zuletzt</th><th className="col-actions" /></tr></thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.id}>
                      <td>{s.deviceName ?? "Gerät"}</td>
                      <td className="sub">{s.appVersion ?? "–"}</td>
                      <td className="sub hide-sm">{relative(s.lastUsedAt)}</td>
                      <td className="col-actions">
                        <ActionForm action={revokeSessionAction}>
                          <input type="hidden" name="userId" value={user.id} /><input type="hidden" name="sessionId" value={s.id} />
                          <SubmitButton className="btn secondary small">Abmelden</SubmitButton>
                        </ActionForm>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="card">
            <div className="card-head"><h2>Community</h2>{community && <span className="sub">{posts.n} Beiträge</span>}</div>
            <div className="card-body stack-tight">
              {!community ? <p className="sub">Nicht in der Community.</p> : (
                <>
                  <dl className="facts">
                    <div><dt>Name</dt><dd>@{community.handle}</dd></div>
                    <div><dt>Sichtbarkeit</dt><dd>{community.visibility === "public" ? "Öffentlich" : community.visibility === "followers" ? "Nur Follower" : "Privat"}</dd></div>
                    <div><dt>Beigetreten</dt><dd>{date(community.createdAt)}</dd></div>
                    <div><dt>Profiltext</dt><dd>{community.bio ?? "–"}</dd></div>
                  </dl>
                  {moderator && (
                    <div className="profile-tools">
                      <ActionForm action={profileAction} className="inline-field">
                        <input type="hidden" name="userId" value={user.id} />
                        <input type="hidden" name="op" value="rename" />
                        <input type="text" name="handle" defaultValue={community.handle} aria-label="Neuer Name" pattern="[a-z0-9_.]{3,24}" />
                        <SubmitButton className="btn secondary" icon="edit">Namen ändern</SubmitButton>
                      </ActionForm>
                      <div className="actions left">
                        {community.bio && <ActionForm action={profileAction}><input type="hidden" name="userId" value={user.id} /><input type="hidden" name="op" value="clear_bio" /><SubmitButton className="btn secondary small">Profiltext entfernen</SubmitButton></ActionForm>}
                        {community.avatarMediaId && <ActionForm action={profileAction}><input type="hidden" name="userId" value={user.id} /><input type="hidden" name="op" value="clear_avatar" /><SubmitButton className="btn secondary small">Profilbild entfernen</SubmitButton></ActionForm>}
                        <Link href={`/admin/community/posts?q=@${community.handle}`} className="btn secondary small">Beiträge ansehen</Link>
                        <ActionForm action={profileAction} confirm={{ title: "Community-Profil entfernen?", text: "Beiträge werden ausgeblendet, Gruppenmitgliedschaften beendet. Tagebuch und Konto bleiben.", confirmLabel: "Entfernen", tone: "danger" }}>
                          <input type="hidden" name="userId" value={user.id} /><input type="hidden" name="op" value="remove" />
                          <SubmitButton className="btn danger small">Profil entfernen</SubmitButton>
                        </ActionForm>
                      </div>
                    </div>
                  )}
                </>
              )}
              {sanctions.length > 0 && (
                <ul className="plain-list">
                  {sanctions.map((s) => (
                    <li key={s.id}>
                      <span className="tag danger">{SANCTION_NAMES[s.kind]}</span>
                      <span className="grow-text">{s.reason}</span>
                      <span className="sub">{s.until ? `bis ${dateTime(s.until)}` : dateTime(s.createdAt)}</span>
                      {moderator && <ActionForm action={liftSanctionAction} success="Sanktion aufgehoben."><input type="hidden" name="sanctionId" value={s.id} /><SubmitButton className="btn secondary small">Aufheben</SubmitButton></ActionForm>}
                    </li>
                  ))}
                </ul>
              )}
              {moderator && community && <SanctionForm userId={user.id} />}
            </div>
          </section>
        </div>

        <aside className="detail-side">
          <section className="card">
            <div className="card-head"><h2>Einwilligungen</h2></div>
            <div className="card-body">
              {consents.length === 0 ? <p className="sub">Noch keine gespeichert.</p> : (
                <ul className="plain-list">
                  {consents.map((c) => (
                    <li key={c.kind}>
                      <span className="grow-text">{CONSENT_NAMES[c.kind] ?? c.kind}</span>
                      <span className={c.granted ? "tag ok" : "tag"}>{c.granted ? "erteilt" : "widerrufen"}</span>
                      <span className="sub full">Version {c.version} · {dateTime(c.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
          <section className="card danger-zone">
            <div className="card-head"><h2>Sperren und Löschen</h2></div>
            <div className="card-body stack-tight">
              {!user.lockedAt && (
                <ActionForm action={lockAction} className="stack-tight" confirm={{ title: "Konto sperren?", text: "Die Person wird auf allen Geräten abgemeldet und kann sich nicht mehr anmelden, bis du entsperrst.", confirmLabel: "Sperren", tone: "danger" }}>
                  <input type="hidden" name="userId" value={user.id} />
                  <input type="text" name="reason" placeholder="Grund, z. B. Missbrauch" required minLength={3} aria-label="Grund der Sperre" />
                  <SubmitButton className="btn danger" icon="lock">Konto sperren</SubmitButton>
                </ActionForm>
              )}
              <ActionForm action={deleteUserAction} className="stack-tight" confirm={{ title: "Konto endgültig löschen?", text: "Alle Daten dieses Kontos werden sofort und unwiderruflich gelöscht, das Apple-Token widerrufen.", confirmLabel: "Endgültig löschen", tone: "danger" }}>
                <input type="hidden" name="userId" value={user.id} />
                <input type="text" name="confirm" placeholder="Zum Bestätigen LÖSCHEN eingeben" aria-label="Bestätigung" required />
                <SubmitButton className="btn danger" icon="trash">Konto löschen</SubmitButton>
              </ActionForm>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
