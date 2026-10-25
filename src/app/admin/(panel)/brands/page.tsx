import Link from "next/link";
import { count, eq, ilike, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { Icon } from "@/components/Icon";
import { requireAdmin } from "@/lib/admin";
import { hasIcon, hasLogo, usesOwnProviderKey } from "@/lib/brands";
import { number } from "@/lib/format";
import { BulkTable, Flash } from "../../components/ui";
import { bulkBrandAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function BrandsPage({ searchParams }: { searchParams: Promise<{ q?: string; deleted?: string; filter?: string }> }) {
  await requireAdmin("brands");
  const { q = "", deleted, filter = "" } = await searchParams;
  const term = q.trim();
  const search = term
    ? or(
        ilike(schema.brands.name, `%${term}%`),
        ilike(schema.brands.domain, `%${term}%`),
        sql`exists (select 1 from brand_aliases a where a.brand_id = ${schema.brands.id} and a.alias ilike ${"%" + term + "%"})`,
      )
    : undefined;

  const rows = await db
    .select({
      brand: schema.brands,
      products: count(schema.foods.id),
      aliases: sql<number>`(select count(*)::int from brand_aliases a where a.brand_id = ${schema.brands.id})`,
    })
    .from(schema.brands)
    .leftJoin(schema.foods, eq(schema.foods.brandId, schema.brands.id))
    .where(search)
    .groupBy(schema.brands.id)
    .orderBy(sql`count(${schema.foods.id}) desc`, schema.brands.name);

  const all = await db.select().from(schema.brands);
  const withLogo = all.filter(hasIcon).length;
  const shown = rows.filter(({ brand }) => (filter === "missing" ? !hasIcon(brand) : filter === "hidden" ? brand.isHidden : filter === "manual" ? brand.source === "manual" : true));

  return (
    <main className="page">
      <Flash message={deleted ? "Marke gelöscht." : null} />
      <div className="header">
        <div>
          <h1>Marken</h1>
          <p>Logos werden beim ersten Scan automatisch gefunden. Hier bearbeiten, ergänzen, ausblenden oder löschen.</p>
        </div>
        <Link href="/admin/brands/new" className="btn primary"><Icon name="plus" size={16} />Marke anlegen</Link>
      </div>

      {!usesOwnProviderKey() && (
        <div className="notice"><strong>Entwicklungsmodus:</strong> Kein eigener Brandfetch-Schlüssel gesetzt. Für den Produktivbetrieb <code>BRANDFETCH_CLIENT_ID</code> hinterlegen.</div>
      )}

      <div className="segmented" role="tablist">
        {([["", "Alle", all.length], ["missing", "Ohne Logo", all.length - withLogo], ["manual", "Manuell gepflegt", all.filter((b) => b.source === "manual").length], ["hidden", "Ausgeblendet", all.filter((b) => b.isHidden).length]] as const).map(([key, label, n]) => (
          <Link key={key} href={`?${new URLSearchParams(Object.entries({ q: term, filter: key }).filter(([, v]) => v))}`} aria-current={filter === key ? "page" : undefined}>{label}<span className="count-inline">{number(n)}</span></Link>
        ))}
      </div>

      <form className="toolbar" role="search">
        {filter && <input type="hidden" name="filter" value={filter} />}
        <input type="search" name="q" defaultValue={term} placeholder="Marke, Schreibweise oder Website" aria-label="Marken suchen" className="grow" />
        <button type="submit" className="btn secondary"><Icon name="search" size={15} />Suchen</button>
      </form>

      <BulkTable
        action={bulkBrandAction}
        noun={["Marke", "Marken"]}
        options={[
          { value: "refresh", label: "Logo neu suchen" },
          { value: "hide", label: "Logo ausblenden" },
          { value: "show", label: "Logo einblenden" },
          { value: "delete", label: "Löschen", destructive: true },
        ]}
      >
        <div className="table-wrap">
          {shown.length === 0 ? (
            <div className="empty-state">
              <Icon name="tag" size={28} />
              <strong>{term ? `Keine Marke passt zu „${term}“` : "Keine Marken"}</strong>
              <span>Marken erscheinen nach dem ersten Barcode-Scan oder über „Marke anlegen“.</span>
            </div>
          ) : (
            <div className="table-scroll">
              <table className="table">
                <thead><tr><th className="col-check"><input type="checkbox" data-select-all aria-label="Alle auswählen" /></th><th>Marke</th><th className="hide-sm">Wortlogo</th><th className="col-num">Produkte</th><th>Status</th><th className="col-actions" /></tr></thead>
                <tbody>
                  {shown.map(({ brand, products, aliases }) => {
                    const icon = hasIcon(brand);
                    const logo = hasLogo(brand);
                    const v = brand.updatedAt.getTime();
                    const status = brand.isHidden ? ["Ausgeblendet", "tag"] : !icon && logo ? ["Nur Wortlogo", "tag warn"] : !icon ? ["Kein Logo", "tag warn"] : brand.customIconId ? ["Eigenes Logo", "tag ok"] : brand.source === "manual" ? ["Manuell", "tag ok"] : ["Automatisch", "tag ok"];
                    return (
                      <tr key={brand.id}>
                        <td className="col-check"><input type="checkbox" name="ids" value={brand.id} aria-label={`${brand.name} auswählen`} /></td>
                        <td>
                          <div className="cell-main">
                            <span className={icon ? "icon" : "icon empty"}>{icon ? <img src={`/api/v1/brands/${brand.id}/icon?v=${v}`} alt="" /> : brand.name.slice(0, 1).toUpperCase()}</span>
                            <div className="cell-text">
                              <Link href={`/admin/brands/${brand.id}`} className="row-link">{brand.name}</Link>
                              <span className="sub">{brand.domain ?? "keine Website"}{aliases > 1 ? ` · ${aliases} Schreibweisen` : ""}</span>
                            </div>
                          </div>
                        </td>
                        <td className="hide-sm">{logo ? <div className="wordmark"><img src={`/api/v1/brands/${brand.id}/icon?kind=logo&v=${v}`} alt={`${brand.name} Logo`} /></div> : <span className="sub">–</span>}</td>
                        <td className="col-num">{products ? <Link href={`/admin/foods?q=${encodeURIComponent(brand.name)}`}>{number(products)}</Link> : "0"}</td>
                        <td><span className={status[1]}>{status[0]}</span></td>
                        <td className="col-actions"><Link href={`/admin/brands/${brand.id}`} className="btn icon-btn" aria-label={`${brand.name} bearbeiten`}><Icon name="edit" size={16} /></Link></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </BulkTable>
    </main>
  );
}
