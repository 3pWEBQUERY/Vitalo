import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { Icon } from "@/components/Icon";
import { requireAdmin } from "@/lib/admin";
import { dateTime, relative } from "@/lib/format";
import { REASON_NAMES } from "@/lib/moderation";
import { ActionForm, SubmitButton } from "../../../../components/ui";
import { SanctionForm } from "../../../moderation/SanctionForm";
import { commentAction, postAction } from "../../actions";
import { POST_KINDS, POST_STATUS, VISIBILITY } from "../../labels";

export const dynamic = "force-dynamic";

function Hidden({ values }: { values: Record<string, string> }) {
  return <>{Object.entries(values).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}</>;
}

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin("moderation");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [row] = await db
    .select({ post: schema.posts, handle: schema.communityProfiles.handle, group: schema.communityGroups })
    .from(schema.posts)
    .leftJoin(schema.communityProfiles, eq(schema.communityProfiles.userId, schema.posts.userId))
    .leftJoin(schema.communityGroups, eq(schema.communityGroups.id, schema.posts.groupId))
    .where(eq(schema.posts.id, id));
  if (!row) notFound();
  const { post, handle, group } = row;

  const [media, comments, reports] = await Promise.all([
    db.select().from(schema.postMedia).where(eq(schema.postMedia.postId, id)).orderBy(asc(schema.postMedia.position)),
    db
      .select({ comment: schema.comments, handle: schema.communityProfiles.handle })
      .from(schema.comments)
      .leftJoin(schema.communityProfiles, eq(schema.communityProfiles.userId, schema.comments.userId))
      .where(eq(schema.comments.postId, id))
      .orderBy(asc(schema.comments.createdAt)),
    db.select().from(schema.reports).where(and(eq(schema.reports.targetType, "post"), eq(schema.reports.targetId, id))).orderBy(desc(schema.reports.createdAt)),
  ]);
  const [statusLabel, statusClass] = post.deletedAt ? ["Gelöscht", "tag"] : POST_STATUS[post.status];
  const categories = (post.moderation?.categories as string[] | undefined) ?? [];

  return (
    <main className="page">
      <Link href="/admin/community/posts" className="back"><Icon name="chevronRight" size={14} className="flip" />Beiträge</Link>
      <div className="header">
        <div>
          <h1>Beitrag</h1>
          <p className="meta-line">
            <span className={statusClass}>{statusLabel}</span>
            <span>{POST_KINDS[post.kind]}</span>
            <span>{VISIBILITY[post.visibility]}{group ? ` · ${group.name}` : ""}</span>
            <span>{dateTime(post.createdAt)}</span>
          </p>
        </div>
        <div className="actions">
          {post.status !== "removed" && !post.deletedAt ? (
            <ActionForm action={postAction}><Hidden values={{ id, op: "hide" }} /><SubmitButton className="btn secondary" icon="eyeOff">Ausblenden</SubmitButton></ActionForm>
          ) : (
            <ActionForm action={postAction}><Hidden values={{ id, op: "restore" }} /><SubmitButton className="btn secondary" icon="undo">Wiederherstellen</SubmitButton></ActionForm>
          )}
          <ActionForm action={postAction} confirm={{ title: "Beitrag endgültig löschen?", text: "Beitrag, Kommentare und Reaktionen werden entfernt. Das lässt sich nicht rückgängig machen.", confirmLabel: "Löschen", tone: "danger" }}>
            <Hidden values={{ id, op: "delete" }} />
            <SubmitButton className="btn danger" icon="trash">Löschen</SubmitButton>
          </ActionForm>
        </div>
      </div>

      <div className="detail-grid">
        <div className="stack">
          <section className="card">
            <div className="card-body stack-tight">
              <div className="author">
                <span className="avatar lg" aria-hidden>{(handle ?? "?").slice(0, 1).toUpperCase()}</span>
                <div>{handle ? <Link href={`/admin/users/${post.userId}`} className="name">@{handle}</Link> : <span className="name">Unbekannt</span>}<span className="sub block">{relative(post.createdAt)}</span></div>
              </div>
              {post.body ? <p className="post-body">{post.body}</p> : <p className="sub">Ohne Text.</p>}
              {media.length > 0 && (
                <div className="media-grid">
                  {media.map((m) => (
                    <a key={m.mediaId} href={`/admin/media/${m.mediaId}`} target="_blank" rel="noreferrer"><img src={`/admin/media/${m.mediaId}?size=thumb`} alt="Bild im Beitrag" loading="lazy" /></a>
                  ))}
                </div>
              )}
              {post.attachment && (
                <dl className="facts">
                  {Object.entries(post.attachment).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{String(v)}</dd></div>)}
                </dl>
              )}
            </div>
          </section>

          <section className="card">
            <div className="card-head"><h2>Kommentare</h2><span className="sub">{comments.length}</span></div>
            {comments.length === 0 ? <div className="empty-state"><span>Noch keine Kommentare.</span></div> : (
              <ul className="comment-list">
                {comments.map(({ comment, handle: who }) => {
                  const hidden = comment.status !== "published" || comment.deletedAt;
                  return (
                    <li key={comment.id} data-hidden={Boolean(hidden)}>
                      <div className="grow-text">
                        <div>{who ? <Link href={`/admin/users/${comment.userId}`} className="name">@{who}</Link> : <span className="name">Unbekannt</span>} <span className="sub">{relative(comment.createdAt)}</span> {hidden && <span className="tag warn">{comment.deletedAt ? "gelöscht" : comment.status === "held" ? "zurückgehalten" : "ausgeblendet"}</span>}</div>
                        <p>{comment.body}</p>
                      </div>
                      <div className="row-actions">
                        {hidden ? (
                          <ActionForm action={commentAction}><Hidden values={{ id: comment.id, op: "restore" }} /><SubmitButton className="btn icon-btn" title="Wiederherstellen"><Icon name="undo" size={16} /></SubmitButton></ActionForm>
                        ) : (
                          <ActionForm action={commentAction}><Hidden values={{ id: comment.id, op: "hide" }} /><SubmitButton className="btn icon-btn" title="Ausblenden"><Icon name="eyeOff" size={16} /></SubmitButton></ActionForm>
                        )}
                        <ActionForm action={commentAction} confirm={{ title: "Kommentar löschen?", confirmLabel: "Löschen", tone: "danger" }}>
                          <Hidden values={{ id: comment.id, op: "delete" }} />
                          <SubmitButton className="btn icon-btn danger" title="Löschen"><Icon name="trash" size={16} /></SubmitButton>
                        </ActionForm>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <aside className="detail-side">
          <section className="card">
            <div className="card-head"><h2>Überblick</h2></div>
            <dl className="card-body facts single">
              <div><dt>Reaktionen</dt><dd>{post.reactionCount}</dd></div>
              <div><dt>Kommentare</dt><dd>{post.commentCount}</dd></div>
              <div><dt>Meldungen</dt><dd>{reports.length}</dd></div>
              <div><dt>Automatische Prüfung</dt><dd>{categories.length ? categories.join(", ") : "unauffällig"}</dd></div>
            </dl>
          </section>
          {reports.length > 0 && (
            <section className="card">
              <div className="card-head"><h2>Meldungen</h2></div>
              <ul className="plain-list card-body">
                {reports.map((r) => (
                  <li key={r.id}>
                    <span className={r.status === "open" ? "tag warn" : "tag"}>{REASON_NAMES[r.reason]}</span>
                    <span className="sub">{relative(r.createdAt)}</span>
                    {r.details && <span className="block full">„{r.details}“</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section className="card">
            <div className="card-head"><h2>Person sanktionieren</h2></div>
            <div className="card-body"><SanctionForm userId={post.userId} targetType="post" targetId={post.id} /></div>
          </section>
        </aside>
      </div>
    </main>
  );
}
