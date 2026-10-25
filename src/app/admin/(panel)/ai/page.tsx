import { and, desc, gte, ne, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/admin";
import { MODEL } from "@/lib/ai";
import { dateTime, number, percent, usd } from "@/lib/format";
import { setting } from "@/lib/settings";
import { ActionForm, SubmitButton } from "../../components/ui";
import { killSwitchAction } from "../settings/actions";

export const dynamic = "force-dynamic";

const KIND_NAMES: Record<string, string> = { photo: "Foto", text: "Text", label: "Nährwerttabelle", coach: "Coach", moderation: "Moderation" };

type Day = { day: string; requests: number; errors: number; input: number; output: number; cached: number; cost: number; p50: number };

export default async function AIPage() {
  await requireAdmin("ai");
  const since = new Date(Date.now() - 30 * 86400_000);
  const days = Array.from(
    await db.execute<Day>(sql`
      select to_char(date_trunc('day', created_at at time zone 'Europe/Zurich'), 'YYYY-MM-DD') as day,
        count(*)::int as requests,
        count(*) filter (where status <> 'ok')::int as errors,
        coalesce(sum(input_tokens), 0)::int as input,
        coalesce(sum(output_tokens), 0)::int as output,
        coalesce(sum(cache_read_tokens), 0)::int as cached,
        coalesce(sum(cost_usd), 0)::float as cost,
        coalesce(percentile_cont(0.5) within group (order by duration_ms), 0)::int as p50
      from ai_requests where created_at >= ${since.toISOString()}::timestamptz
      group by 1 order by 1 desc`),
  );
  const kinds = Array.from(
    await db.execute<{ kind: string; requests: number; cost: number; errors: number }>(sql`
      select kind, count(*)::int as requests, coalesce(sum(cost_usd), 0)::float as cost, count(*) filter (where status <> 'ok')::int as errors
      from ai_requests where created_at >= ${since.toISOString()}::timestamptz group by kind order by cost desc`),
  );
  const errors = await db
    .select({ kind: schema.aiRequests.kind, status: schema.aiRequests.status, error: schema.aiRequests.error, createdAt: schema.aiRequests.createdAt })
    .from(schema.aiRequests)
    .where(and(gte(schema.aiRequests.createdAt, since), ne(schema.aiRequests.status, "ok")))
    .orderBy(desc(schema.aiRequests.createdAt))
    .limit(10);
  const [killed, free, plus] = await Promise.all([setting("ai_kill_switch", false), setting("ai_free_daily_quota", 3), setting("ai_plus_daily_quota", 60)]);
  const total = days.reduce((s, d) => ({ requests: s.requests + d.requests, errors: s.errors + d.errors, cost: s.cost + d.cost }), { requests: 0, errors: 0, cost: 0 });
  const configured = Boolean(process.env.ANTHROPIC_API_KEY);

  return (
    <main className="page">
      <div className="header">
        <div>
          <h1>KI &amp; Kosten</h1>
          <p>Modell {MODEL} · Anfragen, Fehler und Kosten der letzten 30 Tage. Inhalte der Anfragen werden nicht gespeichert.</p>
        </div>
        <ActionForm action={killSwitchAction} confirm={killed ? undefined : { title: "KI für alle sofort abschalten?", text: "Foto- und Texterkennung sowie die KI-Moderation pausieren. Erfassen per Suche und Barcode bleibt möglich.", confirmLabel: "Abschalten", tone: "danger" }}>
          <input type="hidden" name="on" value={String(!killed)} />
          <SubmitButton className={killed ? "btn primary" : "btn danger"} icon={killed ? "undo" : "ban"}>{killed ? "KI wieder einschalten" : "KI sofort abschalten"}</SubmitButton>
        </ActionForm>
      </div>

      {killed && <div className="alert" role="alert"><strong>Notabschaltung aktiv.</strong> Die App bietet nur manuelle Eingabe, Barcode und Suche an.</div>}
      {!configured && <div className="notice"><strong>Kein API-Schlüssel:</strong> <code>ANTHROPIC_API_KEY</code> ist nicht gesetzt, KI-Anfragen antworten mit „nicht verfügbar“.</div>}

      <div className="stats">
        <div className="stat"><span>Anfragen</span><strong>{number(total.requests)}</strong><small>30 Tage</small></div>
        <div className="stat"><span>Fehlerquote</span><strong>{total.requests ? percent(total.errors / total.requests) : "–"}</strong><small>{number(total.errors)} Fehler</small></div>
        <div className="stat"><span>Kosten</span><strong>{usd(total.cost)}</strong><small>{total.requests ? `${usd(total.cost / total.requests)} pro Anfrage` : "–"}</small></div>
        <div className="stat"><span>Tageslimit</span><strong>{free} / {plus}</strong><small>Free / Plus, unter Einstellungen</small></div>
      </div>

      <h2 className="section-title">Nach Art</h2>
      <div className="card scroll-x">
        <div className="row head ai-kinds"><span>Art</span><span>Anfragen</span><span>Fehler</span><span>Kosten</span></div>
        {kinds.length === 0 && <div className="empty-state">Noch keine KI-Anfragen.</div>}
        {kinds.map((k) => (
          <div className="row ai-kinds" key={k.kind}>
            <span className="name">{KIND_NAMES[k.kind] ?? k.kind}</span>
            <span className="num">{number(k.requests)}</span>
            <span className="num">{k.requests ? percent(k.errors / k.requests) : "–"}</span>
            <span className="num">{usd(k.cost)}</span>
          </div>
        ))}
      </div>

      <h2 className="section-title">Pro Tag</h2>
      <div className="card scroll-x">
        <div className="row head ai-days"><span>Tag</span><span>Anfragen</span><span>Fehler</span><span>Tokens ein / aus</span><span>Aus Cache</span><span>Median</span><span>Kosten</span></div>
        {days.length === 0 && <div className="empty-state">Noch keine Daten.</div>}
        {days.map((d) => (
          <div className="row ai-days" key={d.day}>
            <span>{new Intl.DateTimeFormat("de-CH", { weekday: "short", day: "numeric", month: "short" }).format(new Date(d.day))}</span>
            <span className="num">{number(d.requests)}</span>
            <span className={d.errors / d.requests > 0.05 ? "num error" : "num"}>{percent(d.errors / d.requests)}</span>
            <span className="num sub">{number(d.input)} / {number(d.output)}</span>
            <span className="num sub">{d.input + d.cached ? percent(d.cached / (d.input + d.cached)) : "–"}</span>
            <span className="num sub">{(d.p50 / 1000).toFixed(1)} s</span>
            <span className="num">{usd(d.cost)}</span>
          </div>
        ))}
      </div>

      {errors.length > 0 && (
        <>
          <h2 className="section-title">Letzte Fehler</h2>
          <div className="card list">
            {errors.map((e, i) => (
              <div className="list-row static" key={i}>
                <span><span className="tag">{KIND_NAMES[e.kind] ?? e.kind}</span> <span className="tag">{e.status}</span> <span className="sub">{e.error ?? ""}</span></span>
                <span className="sub nowrap">{dateTime(e.createdAt)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
