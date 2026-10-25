import Link from "next/link";
import { and, count, desc, eq, ilike, isNotNull, or, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { Icon } from "@/components/Icon";
import { requireAdmin } from "@/lib/admin";
import { number, relative } from "@/lib/format";
import { ActionForm, BulkTable, Flash, SubmitButton } from "../../components/ui";
import { bulkFoodAction, revisionAction } from "./actions";
import { fieldName, QUALITY_NAMES, qualityClass, SOURCE_NAMES, type Quality } from "./quality";

export const dynamic = "force-dynamic";

const PAGE = 50;
type Params = { q?: string; quality?: string; source?: string; barcode?: string; tab?: string; page?: string; deleted?: string };

export default async function FoodsPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireAdmin("foods");
  const params = await searchParams;
  const { q = "", quality, source, barcode, tab, deleted } = params;
  const page = Math.max(1, Number(params.page) || 1);
  const term = q.trim();

  const counts = await db.select({ quality: schema.foods.quality, n: count() }).from(schema.foods).groupBy(schema.foods.quality);
  const countOf = (key: string) => counts.find((c) => c.quality === key)?.n ?? 0;
  const [pendingCount] = await db.select({ n: count() }).from(schema.foodRevisions).where(eq(schema.foodRevisions.status, "pending"));

  const filters: SQL[] = [];
  if (quality && quality in QUALITY_NAMES) filters.push(eq(schema.foods.quality, quality as Quality));
  if (source && source in SOURCE_NAMES) filters.push(eq(schema.foods.source, source as keyof typeof SOURCE_NAMES));
  if (barcode === "1") filters.push(isNotNull(schema.foods.barcode));
  if (term) filters.push(or(ilike(schema.foods.name, `%${term}%`), ilike(schema.foods.brand, `%${term}%`), eq(schema.foods.barcode, term))!);
  const where = filters.length ? and(...filters) : undefined;

  const [total] = tab === "revisions" ? [{ n: 0 }] : await db.select({ n: count() }).from(schema.foods).where(where);
  const rows = tab === "revisions"
    ? []
    : await db
        .select()
        .from(schema.foods)
        .where(where)
        .orderBy(quality === "suspect" ? desc(schema.foods.reports) : desc(schema.foods.updatedAt))
        .limit(PAGE)
        .offset((page - 1) * PAGE);
  const revisions = tab === "revisions"
    ? await db
        .select({ revision: schema.foodRevisions, food: schema.foods })
        .from(schema.foodRevisions)
        .innerJoin(schema.foods, eq(schema.foods.id, schema.foodRevisions.foodId))
        .where(eq(schema.foodRevisions.status, "pending"))
        .orderBy(schema.foodRevisions.createdAt)
        .limit(100)
    : [];

  const link = (changes: Partial<Params>) => {
    const merged = { q: term || undefined, quality, source, barcode, ...changes };
    const qs = new URLSearchParams(Object.entries(merged).filter(([, v]) => v) as [string, string][]).toString();
    return qs ? `?${qs}` : "?";
  };
  const segments = [
    ["", "Alle", counts.reduce((s, c) => s + c.n, 0)],
    ["suspect", "Verdächtig", countOf("suspect")],
    ["unverified", "Ungeprüft", countOf("unverified")],
    ["community", "Community", countOf("community")],
    ["verified", "Geprüft", countOf("verified")],
  ] as const;
  const from = (page - 1) * PAGE + 1;
  const to = Math.min(page * PAGE, total.n);

  return (
    <main className="page">
      <Flash message={deleted ? "Lebensmittel gelöscht." : null} />
      <div className="header">
        <div>
          <h1>Lebensmittel</h1>
          <p>Werte prüfen, Korrekturen übernehmen, Duplikate zusammenführen und neue Einträge anlegen.</p>
        </div>
        <Link href="/admin/foods/new" className="btn primary"><Icon name="plus" size={16} />Lebensmittel anlegen</Link>
      </div>

      <div className="segmented" role="tablist">
        {segments.map(([key, label, n]) => (
          <Link key={key} href={link({ quality: key || undefined, page: undefined, tab: undefined })} aria-current={tab !== "revisions" && (quality ?? "") === key ? "page" : undefined}>
            {label}<span className="count-inline">{number(n)}</span>
          </Link>
        ))}
        <Link href="?tab=revisions" aria-current={tab === "revisions" ? "page" : undefined}>
          Korrekturen{pendingCount.n ? <span className="badge">{pendingCount.n}</span> : null}
        </Link>
      </div>

      {tab === "revisions" ? (
        <div className="table-wrap">
          {revisions.length === 0 ? (
            <div className="empty-state"><Icon name="check" size={28} /><strong>Keine offenen Korrekturen</strong><span>Vorschläge aus der Community erscheinen hier.</span></div>
          ) : (
            <table className="table">
              <thead><tr><th>Lebensmittel</th><th>Vorschlag</th><th className="hide-sm">Eingereicht</th><th className="col-actions" /></tr></thead>
              <tbody>
                {revisions.map(({ revision, food }) => (
                  <tr key={revision.id}>
                    <td><Link href={`/admin/foods/${food.id}`} className="row-link">{food.name}</Link><span className="sub block">{food.brand ?? "ohne Marke"}</span></td>
                    <td className="diff">
                      {Object.entries(revision.changes).map(([key, value]) => (
                        <div key={key}><span className="sub">{fieldName(key)}</span>{" "}<s>{String((revision.previous ?? {})[key] ?? food[key as keyof typeof food] ?? "–")}</s> → <strong>{String(value ?? "–")}</strong></div>
                      ))}
                    </td>
                    <td className="sub hide-sm">{relative(revision.createdAt)}</td>
                    <td className="col-actions">
                      <div className="row-actions">
                        <ActionForm action={revisionAction} success="Korrektur abgelehnt."><input type="hidden" name="revisionId" value={revision.id} /><input type="hidden" name="decision" value="reject" /><SubmitButton className="btn secondary small">Ablehnen</SubmitButton></ActionForm>
                        <ActionForm action={revisionAction} success="Korrektur übernommen."><input type="hidden" name="revisionId" value={revision.id} /><input type="hidden" name="decision" value="apply" /><SubmitButton className="btn primary small">Übernehmen</SubmitButton></ActionForm>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <>
          <form className="toolbar" role="search">
            {quality && <input type="hidden" name="quality" value={quality} />}
            <input type="search" name="q" defaultValue={term} placeholder="Name, Marke oder Barcode" aria-label="Lebensmittel suchen" className="grow" />
            <select name="source" defaultValue={source ?? ""} aria-label="Quelle">
              <option value="">Alle Quellen</option>
              {Object.entries(SOURCE_NAMES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
            <label className="check small"><input type="checkbox" name="barcode" value="1" defaultChecked={barcode === "1"} />Nur mit Barcode</label>
            <button type="submit" className="btn secondary"><Icon name="filter" size={15} />Filtern</button>
          </form>

          <BulkTable
            action={bulkFoodAction}
            noun={["Eintrag", "Einträge"]}
            options={[
              { value: "verified", label: "Als geprüft markieren" },
              { value: "community", label: "Auf Community setzen" },
              { value: "unverified", label: "Auf ungeprüft setzen" },
              { value: "suspect", label: "Als verdächtig markieren" },
              { value: "delete", label: "Löschen", destructive: true },
            ]}
          >
            <div className="table-wrap">
              {rows.length === 0 ? (
                <div className="empty-state">
                  <Icon name="leaf" size={28} />
                  <strong>{term ? `Nichts gefunden für „${term}“` : "Keine Einträge"}</strong>
                  <span>Passe die Filter an oder lege ein neues Lebensmittel an.</span>
                  <Link href="/admin/foods/new" className="btn secondary small"><Icon name="plus" size={14} />Lebensmittel anlegen</Link>
                </div>
              ) : (
                <div className="table-scroll">
                  <table className="table">
                    <thead>
                      <tr>
                        <th className="col-check"><input type="checkbox" data-select-all aria-label="Alle auswählen" /></th>
                        <th>Lebensmittel</th>
                        <th className="col-num">kcal</th>
                        <th className="col-num hide-sm">P · K · F (g)</th>
                        <th className="hide-sm">Quelle</th>
                        <th>Qualität</th>
                        <th className="hide-sm">Geändert</th>
                        <th className="col-actions" />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((food) => (
                        <tr key={food.id}>
                          <td className="col-check"><input type="checkbox" name="ids" value={food.id} aria-label={`${food.name} auswählen`} /></td>
                          <td>
                            <div className="cell-main">
                              {food.imageUrl ? <img className="product" src={food.imageUrl} alt="" loading="lazy" /> : <span className="product empty"><Icon name="leaf" size={16} /></span>}
                              <div className="cell-text">
                                <Link href={`/admin/foods/${food.id}`} className="row-link">{food.name}</Link>
                                <span className="sub">{[food.brand, food.barcode].filter(Boolean).join(" · ") || "ohne Marke"}{food.reports ? ` · ${food.reports} Meldungen` : ""}</span>
                              </div>
                            </div>
                          </td>
                          <td className="col-num">{number(food.kcal100)}</td>
                          <td className="col-num sub hide-sm">{[food.protein100, food.carbs100, food.fat100].map((v) => (v === null ? "–" : number(v, 1))).join(" · ")}</td>
                          <td className="sub hide-sm">{SOURCE_NAMES[food.source]}{food.isPrivate ? " · privat" : ""}</td>
                          <td><span className={qualityClass(food.quality)}>{QUALITY_NAMES[food.quality]}</span></td>
                          <td className="sub hide-sm nowrap">{relative(food.updatedAt)}</td>
                          <td className="col-actions"><Link href={`/admin/foods/${food.id}`} className="btn icon-btn" aria-label={`${food.name} bearbeiten`}><Icon name="edit" size={16} /></Link></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </BulkTable>
          {total.n > 0 && (
            <div className="pager">
              <span>{number(from)}–{number(to)} von {number(total.n)}</span>
              <div className="pager-buttons">
                {page > 1 && <Link className="btn secondary small" href={link({ page: String(page - 1) })}>Zurück</Link>}
                {to < total.n && <Link className="btn secondary small" href={link({ page: String(page + 1) })}>Weiter</Link>}
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
