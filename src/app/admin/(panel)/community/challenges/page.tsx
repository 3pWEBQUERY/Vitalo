import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { Icon } from "@/components/Icon";
import { requireAdmin } from "@/lib/admin";
import { date, number } from "@/lib/format";
import { Flash } from "../../../components/ui";
import { CHALLENGE_KINDS, challengePhase } from "../labels";

export const dynamic = "force-dynamic";

export default async function ChallengesPage({ searchParams }: { searchParams: Promise<{ deleted?: string; scope?: string }> }) {
  await requireAdmin("moderation");
  const { deleted, scope = "vitalo" } = await searchParams;
  const rows = await db
    .select({
      challenge: schema.challenges,
      group: schema.communityGroups.name,
      participants: sql<number>`(select count(distinct user_id)::int from challenge_progress p where p.challenge_id = ${schema.challenges.id})`,
      days: sql<number>`(select count(*)::int from challenge_progress p where p.challenge_id = ${schema.challenges.id})`,
    })
    .from(schema.challenges)
    .leftJoin(schema.communityGroups, eq(schema.communityGroups.id, schema.challenges.groupId))
    .where(scope === "groups" ? sql`${schema.challenges.groupId} is not null` : sql`${schema.challenges.groupId} is null`)
    .orderBy(desc(schema.challenges.startsOn))
    .limit(200);

  return (
    <main className="page">
      <Flash message={deleted ? "Challenge gelöscht." : null} />
      <div className="header">
        <div>
          <h1>Challenges</h1>
          <p>Challenges von Vitalo stehen allen offen. Gruppen-Challenges legen Gruppen selbst an.</p>
        </div>
        <Link href="/admin/community/challenges/new" className="btn primary"><Icon name="plus" size={16} />Challenge anlegen</Link>
      </div>
      <div className="segmented" role="tablist">
        <Link href="?scope=vitalo" aria-current={scope !== "groups" ? "page" : undefined}>Von Vitalo</Link>
        <Link href="?scope=groups" aria-current={scope === "groups" ? "page" : undefined}>In Gruppen</Link>
      </div>
      <div className="table-wrap">
        {rows.length === 0 ? (
          <div className="empty-state">
            <Icon name="trophy" size={28} />
            <strong>{scope === "groups" ? "Keine Gruppen-Challenges" : "Noch keine Challenges"}</strong>
            <span>{scope === "groups" ? "Sie erscheinen, sobald eine Gruppe eine anlegt." : "Lege die erste Challenge für die ganze Community an."}</span>
            {scope !== "groups" && <Link href="/admin/community/challenges/new" className="btn secondary small"><Icon name="plus" size={14} />Challenge anlegen</Link>}
          </div>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead><tr><th>Challenge</th><th className="hide-sm">Art</th><th>Zeitraum</th><th className="col-num">Teilnehmende</th><th className="col-num hide-sm">Erfüllte Tage</th><th>Status</th><th className="col-actions" /></tr></thead>
              <tbody>
                {rows.map(({ challenge, group, participants, days }) => {
                  const [phase, cls] = challengePhase(challenge.startsOn, challenge.endsOn);
                  return (
                    <tr key={challenge.id}>
                      <td><div className="cell-text"><Link href={`/admin/community/challenges/${challenge.id}`} className="row-link">{challenge.title}</Link><span className="sub">{group ? `Gruppe ${group}` : `Ziel: ${challenge.targetDays} Tage`}</span></div></td>
                      <td className="sub hide-sm">{CHALLENGE_KINDS[challenge.kind]}</td>
                      <td className="sub nowrap">{date(challenge.startsOn)} – {date(challenge.endsOn)}</td>
                      <td className="col-num">{number(participants)}</td>
                      <td className="col-num hide-sm">{number(days)}</td>
                      <td><span className={cls}>{phase}</span></td>
                      <td className="col-actions"><Link href={`/admin/community/challenges/${challenge.id}`} className="btn icon-btn" aria-label="Bearbeiten"><Icon name="edit" size={16} /></Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
