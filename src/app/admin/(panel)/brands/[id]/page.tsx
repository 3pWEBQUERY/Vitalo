import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { hasIcon, hasLogo } from "@/lib/brands";
import { BrandForm } from "@/components/BrandForm";
import { Icon } from "@/components/Icon";
import { ActionForm, Flash, SubmitButton } from "../../../components/ui";
import { deleteBrandAction, refreshBrandAction, toggleHiddenAction, updateBrandAction } from "../actions";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function EditBrandPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  await requireAdmin("brands");
  const { id } = await params;
  const { created } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [brand] = await db.select().from(schema.brands).where(eq(schema.brands.id, id)).limit(1);
  if (!brand) notFound();
  const aliases = await db.select().from(schema.brandAliases).where(eq(schema.brandAliases.brandId, id)).orderBy(schema.brandAliases.alias);
  const products = await db.select().from(schema.foods).where(eq(schema.foods.brandId, id)).orderBy(desc(schema.foods.updatedAt)).limit(50);
  const v = brand.updatedAt.getTime();

  return (
    <main className="page narrow">
      <Link href="/admin/brands" className="back"><Icon name="chevronRight" size={14} className="flip" />Marken</Link>
      <div className="header">
        <div className="title-with-icon">
          <div className={hasIcon(brand) ? "icon large" : "icon large empty"}>
            {hasIcon(brand) ? <img src={`/api/v1/brands/${brand.id}/icon?v=${v}`} alt="" /> : brand.name.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <h1>{brand.name}</h1>
            <p>
              {brand.source === "manual" ? "Manuell gepflegt" : brand.source === "brandfetch" ? "Automatisch gefunden" : "Kein Logo gefunden"}
              {brand.domain ? ` · ${brand.domain}` : ""}
            </p>
          </div>
        </div>
        <div className="actions">
          <ActionForm action={toggleHiddenAction}>
            <input type="hidden" name="id" value={brand.id} />
            <input type="hidden" name="hidden" value={String(!brand.isHidden)} />
            <SubmitButton className="btn secondary" icon={brand.isHidden ? "undo" : "eyeOff"}>{brand.isHidden ? "Logo einblenden" : "Logo ausblenden"}</SubmitButton>
          </ActionForm>
          <ActionForm action={refreshBrandAction}>
            <input type="hidden" name="id" value={brand.id} />
            <SubmitButton className="btn secondary" icon="search" pendingLabel="Suche …">Logo neu suchen</SubmitButton>
          </ActionForm>
        </div>
      </div>

      <Flash message={created ? "Marke angelegt." : null} />

      <BrandForm
        action={updateBrandAction}
        submitLabel="Speichern"
        brand={{
          id: brand.id,
          name: brand.name,
          domain: brand.domain,
          aliases: aliases.map((a) => a.alias),
          isHidden: brand.isHidden,
          iconSrc: hasIcon(brand) ? `/api/v1/brands/${brand.id}/icon?v=${v}` : null,
          logoSrc: hasLogo(brand) ? `/api/v1/brands/${brand.id}/icon?kind=logo&v=${v}` : null,
          hasCustomIcon: Boolean(brand.customIconId),
          hasCustomLogo: Boolean(brand.customLogoId),
        }}
      />

      <section className="card form-section">
        <div className="form-section-head"><h2>Produkte dieser Marke</h2></div>
        {products.length === 0 ? (
          <p className="sub">Noch keine Produkte.</p>
        ) : (
          <ul className="plain-list">
            {products.map((food) => (
              <li key={food.id}>
                {food.imageUrl ? <img className="product small" src={food.imageUrl} alt="" /> : <span className="icon empty small">?</span>}
                <Link href={`/admin/foods/${food.id}`} className="grow-text name">{food.names?.de ?? food.name}</Link>
                <span className="sub">{food.barcode}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card form-section danger-zone">
        <div className="form-section-head"><h2>Marke löschen</h2><p>Die Marke, ihre Schreibweisen und hochgeladenen Logos werden gelöscht. Produkte behalten ihren Markennamen, zeigen aber kein Logo mehr.</p></div>
        <ActionForm action={deleteBrandAction} confirm={{ title: `„${brand.name}“ löschen?`, text: "Das lässt sich nicht rückgängig machen.", confirmLabel: "Löschen", tone: "danger" }}>
          <input type="hidden" name="id" value={brand.id} />
          <SubmitButton className="btn danger" icon="trash">Marke löschen</SubmitButton>
        </ActionForm>
      </section>
    </main>
  );
}
