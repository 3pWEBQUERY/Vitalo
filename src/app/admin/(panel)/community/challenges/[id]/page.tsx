import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { Icon } from "@/components/Icon";
import { requireAdmin } from "@/lib/admin";
import { date, number } from "@/lib/format";
import { ActionForm, Flash, SubmitButton } from "../../../../components/ui";
import { deleteChallengeAction } from "../../actions";
import { CHALLENGE_KINDS, challengePhase } from "../../labels";
import { ChallengeForm } from "../ChallengeForm";

export const dynamic = "force-dynamic";

export default async function ChallengePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  await requireAdmin("moderation");
  const { id } = await params;
  const { created } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [challenge] = await db.select().from(schema.challenges).where(eq(schema.challenges.id, id));
  if (!challenge) notFound();
  const [[stats], [group]] = await Promise.all([
    db.execute<{ participants: number; days: number; completed: number }>(sql`
      select count(distinct user_id)::int as participants, count(*)::int as days,
        (select count(*)::int from (select user_id from challenge_progress where challenge_id = ${id} group by user_id having count(*) >= ${challenge.targetDays}) done) as completed
      from challenge_progress where challenge_id = ${id}`),
    challenge.groupId ? db.select().from(schema.communityGroups).where(eq(schema.communityGroups.id, challenge.groupId)) : Promise.resolve([]),
  ]);
  const [phase, cls] = challengePhase(challenge.startsOn, challenge.endsOn);

  return (
    <main className="page">
      <Flash message={created ? "Challenge angelegt." : null} />
      <Link href="/admin/community/challenges" className="back"><Icon name="chevronRight" size={14} className="flip" />Challenges</Link>
      <div className="header">
        <div>
          <h1>{challenge.title}</h1>
          <p className="meta-line">
            <span className={cls}>{phase}</span>
            <span>{CHALLENGE_KINDS[challenge.kind]}</span>
            <span>{date(challenge.startsOn)} – {date(challenge.endsOn)}</span>
            <span>{group ? <Link href={`/admin/community/groups/${group.id}`}>Gruppe {group.name}</Link> : "Von Vitalo"}</span>
          </p>
        </div>
      </div>
      <div className="stats">
        <div className="stat"><span>Teilnehmende</span><strong>{number(stats.participants)}</strong></div>
        <div className="stat"><span>Erfüllte Tage</span><strong>{number(stats.days)}</strong></div>
        <div className="stat"><span>Abgeschlossen</span><strong>{number(stats.completed)}</strong><small>Ziel: {challenge.targetDays} Tage</small></div>
      </div>
      <div className="detail-grid">
        <ChallengeForm challenge={challenge} />
        <aside className="detail-side">
          <section className="card danger-zone">
            <div className="card-head"><h2>Löschen</h2></div>
            <div className="card-body stack-tight">
              <p className="sub">Der Fortschritt aller Teilnehmenden wird mit gelöscht.</p>
              <ActionForm action={deleteChallengeAction} confirm={{ title: `„${challenge.title}“ löschen?`, text: "Teilnahmen und Fortschritt werden entfernt. Das lässt sich nicht rückgängig machen.", confirmLabel: "Löschen", tone: "danger" }}>
                <input type="hidden" name="id" value={challenge.id} />
                <SubmitButton className="btn danger" icon="trash">Challenge löschen</SubmitButton>
              </ActionForm>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
