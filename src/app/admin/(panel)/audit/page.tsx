import Link from "next/link";
import { and, desc, eq, like, lt, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/admin";
import { dateTime } from "@/lib/format";
import { actionLabel } from "./labels";

export const dynamic = "force-dynamic";

const PAGE = 50;
const TARGET_NAMES: Record<string, string> = { admin: "Admin", brand: "Marke", food: "Lebensmittel", user: "Konto", setting: "Einstellung", flag: "Funktion", post: "Beitrag", comment: "Kommentar", group: "Gruppe", challenge: "Challenge" };
const AREAS = [
  ["", "Alle"],
  ["admin.", "Team & Anmeldung"],
  ["brand.", "Marken"],
  ["food.", "Lebensmittel"],
  ["user.", "Nutzer"],
  ["report.", "Meldungen"],
  ["sanction.", "Sanktionen"],
  ["flag.", "Funktionen"],
  ["group.", "Gruppen"],
  ["challenge.", "Challenges"],
  ["setting.", "Einstellungen"],
] as const;

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ area?: string; before?: string; target?: string }> }) {
  await requireAdmin("audit");
  const { area = "", before, target } = await searchParams;
  const filters: SQL[] = [];
  if (area) filters.push(like(schema.auditLog.action, `${area}%`));
  if (before && /^\d+$/.test(before)) filters.push(lt(schema.auditLog.id, Number(before)));
  if (target) filters.push(eq(schema.auditLog.targetId, target));
  const rows = await db
    .select({ entry: schema.auditLog, name: schema.adminUsers.name, email: schema.adminUsers.email })
    .from(schema.auditLog)
    .leftJoin(schema.adminUsers, eq(schema.adminUsers.id, schema.auditLog.adminId))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(schema.auditLog.id))
    .limit(PAGE + 1);
  const more = rows.length > PAGE;
  const shown = rows.slice(0, PAGE);
  const query = (extra: Record<string, string>) => `?${new URLSearchParams({ ...(area ? { area } : {}), ...(target ? { target } : {}), ...extra })}`;

  return (
    <main className="page">
      <div className="header">
        <div>
          <h1>Protokoll</h1>
          <p>Jede Änderung im Admin-Bereich: wer, was, wann. Einträge lassen sich nicht bearbeiten oder löschen.</p>
        </div>
      </div>
      <div className="segmented" role="tablist">
        {AREAS.map(([value, label]) => (
          <Link key={value} href={value ? `?area=${value}` : "?"} aria-current={area === value ? "page" : undefined}>{label}</Link>
        ))}
      </div>
      {target && <div className="notice">Gefiltert auf Ziel <code>{target}</code> · <Link href={area ? `?area=${area}` : "?"}>Filter entfernen</Link></div>}
      <div className="card">
        <div className="row head audit"><span>Zeit</span><span>Wer</span><span>Aktion</span><span>Ziel</span></div>
        {shown.length === 0 && <div className="empty-state">Keine Einträge.</div>}
        {shown.map(({ entry, name, email }) => (
          <div className="row audit" key={entry.id}>
            <span className="sub nowrap">{dateTime(entry.createdAt)}</span>
            <span>{name ? <><strong>{name}</strong><div className="sub">{email}</div></> : <span className="sub">System</span>}</span>
            <span>
              {actionLabel(entry.action)}
              {entry.details && Object.keys(entry.details).length > 0 && (
                <div className="sub details">
                  {Object.entries(entry.details).map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`).join(" · ")}
                </div>
              )}
            </span>
            <span className="sub">
              {entry.targetId ? <Link href={query({ target: entry.targetId })} className="mono">{TARGET_NAMES[entry.targetType ?? ""] ?? entry.targetType} {entry.targetId.length === 36 ? entry.targetId.slice(0, 8) : entry.targetId}</Link> : "–"}
            </span>
          </div>
        ))}
      </div>
      {more && (
        <div className="pager">
          <Link className="button quiet" href={query({ before: String(shown[shown.length - 1].entry.id) })}>Ältere Einträge</Link>
        </div>
      )}
    </main>
  );
}
