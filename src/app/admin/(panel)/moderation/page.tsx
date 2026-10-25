import Link from "next/link";
import { desc, eq, ne, or, sql, gt, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { Icon } from "@/components/Icon";
import { requireAdmin } from "@/lib/admin";
import { dateTime, relative } from "@/lib/format";
import { heldContent, openAppeals, openReports, REASON_NAMES, SANCTION_NAMES, TARGET_NAMES, type ReportGroup } from "@/lib/moderation";
import { ActionForm, SubmitButton } from "../../components/ui";
import { POST_KINDS } from "../community/labels";
import { appealAction, approveAction, dismissAction, liftSanctionAction, removeAction } from "./actions";
import { SanctionForm } from "./SanctionForm";

export const dynamic = "force-dynamic";

function Hidden({ values }: { values: Record<string, string> }) {
  return <>{Object.entries(values).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}</>;
}

function ReportCard({ group }: { group: ReportGroup }) {
  const p = group.preview;
  const ids = { targetType: group.targetType, targetId: group.targetId };
  const gone = p?.status === "removed" || p?.status === "deleted";
  const link = group.targetType === "post" ? `/admin/community/posts/${group.targetId}` : group.targetType === "group" ? `/admin/community/groups/${group.targetId}` : p?.link;
  return (
    <article className="card mod-item">
      <header className="mod-head">
        <div>
          <span className={group.urgent ? "tag danger" : "tag"}>{TARGET_NAMES[group.targetType]}</span>
          {group.reasons.map((r) => <span key={r} className="tag plain">{REASON_NAMES[r]}</span>)}
        </div>
        <span className="sub">{group.reporters} {group.reporters === 1 ? "Meldung" : "Meldungen"} · seit {relative(group.first)}</span>
      </header>
      <div className="mod-body">
        <div className="name">
          {link ? <Link href={link}>{p?.title}</Link> : p?.title ?? "Nicht mehr vorhanden"}
          {p?.author?.handle && <span className="sub"> · von <Link href={`/admin/users/${p.author.userId}`}>@{p.author.handle}</Link></span>}
          {p && p.status !== "published" && p.status !== "active" && <span className="tag warn" style={{ marginLeft: 8 }}>{p.status === "held" ? "ausgeblendet" : p.status}</span>}
        </div>
        {p?.body && <blockquote>{p.body}</blockquote>}
        {group.details.length > 0 && <ul className="report-notes">{group.details.slice(0, 3).map((d, i) => <li key={i}>„{d}“</li>)}</ul>}
      </div>
      <footer className="mod-actions">
        <ActionForm action={dismissAction}><Hidden values={ids} /><SubmitButton className="btn secondary">Verwerfen</SubmitButton></ActionForm>
        {!gone && group.targetType !== "user" && (
          <ActionForm action={removeAction} confirm={{ title: "Inhalt entfernen?", text: "Er verschwindet aus der Community. Die Meldungen gelten als erledigt.", confirmLabel: "Entfernen", tone: "danger" }}>
            <Hidden values={ids} /><SubmitButton className="btn danger" icon="eyeOff">Entfernen</SubmitButton>
          </ActionForm>
        )}
        {p?.author && <SanctionForm userId={p.author.userId} targetType={group.targetType} targetId={group.targetId} />}
      </footer>
    </article>
  );
}

function Empty({ icon, title, text }: { icon: "check" | "flag"; title: string; text: string }) {
  return <div className="card empty-state"><Icon name={icon} size={28} /><strong>{title}</strong><span>{text}</span></div>;
}

export default async function ModerationPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireAdmin("moderation");
  const { tab = "reports" } = await searchParams;
  const [reports, held, appeals] = await Promise.all([openReports(), heldContent(), openAppeals()]);
  const sanctions = tab === "sanctions"
    ? await db
        .select({ sanction: schema.userSanctions, handle: schema.communityProfiles.handle, admin: schema.adminUsers.name })
        .from(schema.userSanctions)
        .leftJoin(schema.communityProfiles, eq(schema.communityProfiles.userId, schema.userSanctions.userId))
        .leftJoin(schema.adminUsers, eq(schema.adminUsers.id, schema.userSanctions.adminId))
        .where(or(ne(schema.userSanctions.kind, "suspension"), isNull(schema.userSanctions.until), gt(schema.userSanctions.until, new Date())))
        .orderBy(desc(schema.userSanctions.createdAt))
        .limit(200)
    : [];
  const history = tab === "history"
    ? await db
        .select({ report: schema.reports, admin: schema.adminUsers.name })
        .from(schema.reports)
        .leftJoin(schema.adminUsers, eq(schema.adminUsers.id, schema.reports.resolvedBy))
        .where(ne(schema.reports.status, "open"))
        .orderBy(desc(sql`coalesce(${schema.reports.resolvedAt}, ${schema.reports.createdAt})`))
        .limit(200)
    : [];
  const heldCount = held.posts.length + held.comments.length;
  const tabs = [
    ["reports", "Meldungen", reports.length],
    ["held", "Zurückgehalten", heldCount],
    ["appeals", "Einsprüche", appeals.length],
    ["sanctions", "Sanktionen", 0],
    ["history", "Erledigt", 0],
  ] as const;

  return (
    <main className="page">
      <div className="header">
        <div>
          <h1>Moderation</h1>
          <p>Meldungen zu Essstörung, Belästigung und Body-Shaming stehen immer oben.</p>
        </div>
      </div>
      <div className="segmented" role="tablist">
        {tabs.map(([key, label, n]) => (
          <Link key={key} href={`?tab=${key}`} aria-current={tab === key ? "page" : undefined}>{label}{n ? <span className="badge">{n}</span> : null}</Link>
        ))}
      </div>

      {tab === "reports" && (
        <div className="stack">
          {reports.length === 0 && <Empty icon="check" title="Alles erledigt" text="Keine offenen Meldungen." />}
          {reports.map((g) => <ReportCard key={`${g.targetType}:${g.targetId}`} group={g} />)}
        </div>
      )}

      {tab === "held" && (
        <div className="stack">
          {heldCount === 0 && <Empty icon="check" title="Nichts zurückgehalten" text="Beiträge, die die automatische Prüfung anhält, erscheinen hier." />}
          {held.posts.map(({ post, handle }) => {
            const categories = (post.moderation?.categories as string[] | undefined) ?? [];
            return (
              <article className="card mod-item" key={post.id}>
                <header className="mod-head">
                  <div><span className="tag warn">Beitrag</span>{categories.map((c) => <span key={c} className="tag plain">{c}</span>)}</div>
                  <span className="sub">{dateTime(post.createdAt)}</span>
                </header>
                <div className="mod-body">
                  <div className="name">{handle ? <Link href={`/admin/users/${post.userId}`}>@{handle}</Link> : "Unbekannt"} <span className="sub">· {POST_KINDS[post.kind]} · <Link href={`/admin/community/posts/${post.id}`}>öffnen</Link></span></div>
                  {post.body && <blockquote>{post.body}</blockquote>}
                </div>
                <footer className="mod-actions">
                  <ActionForm action={approveAction}><Hidden values={{ targetType: "post", targetId: post.id }} /><SubmitButton className="btn primary" icon="check">Freigeben</SubmitButton></ActionForm>
                  <ActionForm action={removeAction} confirm={{ title: "Beitrag entfernen?", confirmLabel: "Entfernen", tone: "danger" }}><Hidden values={{ targetType: "post", targetId: post.id }} /><SubmitButton className="btn danger" icon="eyeOff">Entfernen</SubmitButton></ActionForm>
                  <SanctionForm userId={post.userId} targetType="post" targetId={post.id} />
                </footer>
              </article>
            );
          })}
          {held.comments.map(({ comment, handle }) => (
            <article className="card mod-item" key={comment.id}>
              <header className="mod-head"><div><span className="tag warn">Kommentar</span></div><span className="sub">{dateTime(comment.createdAt)}</span></header>
              <div className="mod-body">
                <div className="name">{handle ? <Link href={`/admin/users/${comment.userId}`}>@{handle}</Link> : "Unbekannt"} <span className="sub">· <Link href={`/admin/community/posts/${comment.postId}`}>zum Beitrag</Link></span></div>
                <blockquote>{comment.body}</blockquote>
              </div>
              <footer className="mod-actions">
                <ActionForm action={approveAction}><Hidden values={{ targetType: "comment", targetId: comment.id }} /><SubmitButton className="btn primary" icon="check">Freigeben</SubmitButton></ActionForm>
                <ActionForm action={removeAction}><Hidden values={{ targetType: "comment", targetId: comment.id }} /><SubmitButton className="btn danger" icon="eyeOff">Entfernen</SubmitButton></ActionForm>
              </footer>
            </article>
          ))}
        </div>
      )}

      {tab === "appeals" && (
        <div className="stack">
          {appeals.length === 0 && <Empty icon="check" title="Keine offenen Einsprüche" text="Einsprüche gegen Sanktionen erscheinen hier." />}
          {appeals.map(({ appeal, sanction, handle }) => (
            <article className="card mod-item" key={appeal.id}>
              <header className="mod-head">
                <div><span className="tag info">{sanction ? SANCTION_NAMES[sanction.kind] : "Sanktion aufgehoben"}</span>{handle ? <Link href={`/admin/users/${appeal.userId}`}>@{handle}</Link> : null}</div>
                <span className="sub">{dateTime(appeal.createdAt)}</span>
              </header>
              <div className="mod-body">
                {sanction && <div className="sub">Begründung der Sanktion: {sanction.reason}{sanction.until ? ` · bis ${dateTime(sanction.until)}` : ""}</div>}
                <blockquote>{appeal.body}</blockquote>
              </div>
              <footer className="mod-actions">
                <ActionForm action={appealAction}><Hidden values={{ appealId: appeal.id, decision: "deny" }} /><SubmitButton className="btn secondary">Ablehnen</SubmitButton></ActionForm>
                <ActionForm action={appealAction}><Hidden values={{ appealId: appeal.id, decision: "grant" }} /><SubmitButton className="btn primary" icon="check">Stattgeben und Sanktion aufheben</SubmitButton></ActionForm>
              </footer>
            </article>
          ))}
        </div>
      )}

      {tab === "sanctions" && (
        <div className="table-wrap">
          {sanctions.length === 0 ? <div className="empty-state"><Icon name="check" size={28} /><strong>Keine aktiven Sanktionen</strong></div> : (
            <table className="table">
              <thead><tr><th>Person</th><th>Art</th><th>Begründung</th><th className="hide-sm">Von</th><th className="hide-sm">Seit</th><th className="col-actions" /></tr></thead>
              <tbody>
                {sanctions.map(({ sanction, handle, admin }) => (
                  <tr key={sanction.id}>
                    <td>{handle ? <Link href={`/admin/users/${sanction.userId}`} className="row-link">@{handle}</Link> : <Link href={`/admin/users/${sanction.userId}`} className="mono">{sanction.userId.slice(0, 8)}</Link>}</td>
                    <td><span className={sanction.kind === "warning" ? "tag warn" : "tag danger"}>{SANCTION_NAMES[sanction.kind]}</span>{sanction.until && <span className="sub block">bis {dateTime(sanction.until)}</span>}</td>
                    <td>{sanction.reason}</td>
                    <td className="sub hide-sm">{admin ?? "System"}</td>
                    <td className="sub hide-sm nowrap">{relative(sanction.createdAt)}</td>
                    <td className="col-actions">
                      <ActionForm action={liftSanctionAction} confirm={{ title: "Sanktion aufheben?", confirmLabel: "Aufheben" }}>
                        <input type="hidden" name="sanctionId" value={sanction.id} />
                        <SubmitButton className="btn secondary small">Aufheben</SubmitButton>
                      </ActionForm>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "history" && (
        <div className="table-wrap">
          {history.length === 0 ? <div className="empty-state"><Icon name="list" size={28} /><strong>Noch nichts erledigt</strong></div> : (
            <table className="table">
              <thead><tr><th>Ziel</th><th>Grund</th><th>Ergebnis</th><th className="hide-sm">Von</th><th className="hide-sm">Erledigt</th></tr></thead>
              <tbody>
                {history.map(({ report, admin }) => (
                  <tr key={report.id}>
                    <td>
                      {report.targetType === "post" ? <Link href={`/admin/community/posts/${report.targetId}`}>{TARGET_NAMES.post}</Link>
                        : report.targetType === "user" ? <Link href={`/admin/users/${report.targetId}`}>{TARGET_NAMES.user}</Link>
                        : report.targetType === "food" ? <Link href={`/admin/foods/${report.targetId}`}>{TARGET_NAMES.food}</Link>
                        : TARGET_NAMES[report.targetType]}
                      <span className="sub mono block">{report.targetId.slice(0, 8)}</span>
                    </td>
                    <td><span className="tag plain">{REASON_NAMES[report.reason]}</span></td>
                    <td><span className={report.status === "actioned" ? "tag ok" : "tag"}>{report.status === "actioned" ? "Massnahme" : "Verworfen"}</span></td>
                    <td className="sub hide-sm">{admin ?? "System"}</td>
                    <td className="sub hide-sm nowrap">{relative(report.resolvedAt ?? report.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </main>
  );
}
