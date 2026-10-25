import Link from "next/link";
import { db, schema } from "@/db";
import { Icon } from "@/components/Icon";
import { requireAdmin, ROLE_NAMES, ROLE_TEXT } from "@/lib/admin";
import { relative } from "@/lib/format";
import { Flash } from "../../components/ui";

export const dynamic = "force-dynamic";


export default async function TeamPage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const me = await requireAdmin("team");
  const { deleted } = await searchParams;
  const team = await db.select().from(schema.adminUsers).orderBy(schema.adminUsers.name);
  const now = new Date();

  return (
    <main className="page">
      <Flash message={deleted ? "Konto entfernt." : null} />
      <div className="header">
        <div>
          <h1>Team</h1>
          <p>Wer auf den Admin-Bereich zugreift und was die jeweilige Rolle erlaubt.</p>
        </div>
        <Link href="/admin/team/new" className="btn primary"><Icon name="plus" size={16} />Person aufnehmen</Link>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Person</th><th>Rolle</th><th className="hide-sm">Zwei-Faktor</th><th>Status</th><th className="hide-sm">Letzte Anmeldung</th><th className="col-actions" /></tr></thead>
          <tbody>
            {team.map((a) => {
              const locked = a.lockedUntil && a.lockedUntil > now;
              return (
                <tr key={a.id}>
                  <td>
                    <div className="cell-main">
                      <span className="avatar" aria-hidden>{a.name.slice(0, 1).toUpperCase()}</span>
                      <div className="cell-text"><Link href={`/admin/team/${a.id}`} className="row-link">{a.name}{a.id === me.id ? " (du)" : ""}</Link><span className="sub">{a.email}</span></div>
                    </div>
                  </td>
                  <td><span className="name">{ROLE_NAMES[a.role]}</span><span className="sub block">{ROLE_TEXT[a.role]}</span></td>
                  <td className="hide-sm">{a.totpEnabled ? <span className="tag ok">Aktiv</span> : <span className="tag warn">Fehlt</span>}</td>
                  <td>{a.disabledAt ? <span className="tag">Deaktiviert</span> : locked ? <span className="tag danger">Gesperrt</span> : <span className="tag ok">Aktiv</span>}</td>
                  <td className="sub hide-sm nowrap">{a.lastLoginAt ? relative(a.lastLoginAt) : "nie"}</td>
                  <td className="col-actions"><Link href={`/admin/team/${a.id}`} className="btn icon-btn" aria-label={`${a.name} bearbeiten`}><Icon name="edit" size={16} /></Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
