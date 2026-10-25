import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, count, desc, eq, ne, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { Icon } from "@/components/Icon";
import { requireAdmin } from "@/lib/admin";
import { plausibilityIssues } from "@/lib/foods";
import { dateTime, number, relative } from "@/lib/format";
import { REASON_NAMES } from "@/lib/moderation";
import { ActionForm, Flash, SubmitButton } from "../../../components/ui";
import { deleteFoodAction, mergeFoodAction, revisionAction, setQualityAction } from "../actions";
import { fieldName, issueText, QUALITY_NAMES, qualityClass, SOURCE_NAMES } from "../quality";
import { FoodForm } from "./FoodForm";

export const dynamic = "force-dynamic";

export default async function FoodPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ merged?: string; created?: string }> }) {
  await requireAdmin("foods");
  const { id } = await params;
  const { merged, created } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [food] = await db.select().from(schema.foods).where(eq(schema.foods.id, id));
  if (!food) notFound();

  const [revisions, reports, [uses], duplicates, brands] = await Promise.all([
    db
      .select({ revision: schema.foodRevisions, admin: schema.adminUsers.name })
      .from(schema.foodRevisions)
      .leftJoin(schema.adminUsers, eq(schema.adminUsers.id, schema.foodRevisions.adminId))
      .where(eq(schema.foodRevisions.foodId, id))
      .orderBy(desc(schema.foodRevisions.createdAt))
      .limit(30),
    db.select().from(schema.reports).where(and(eq(schema.reports.targetType, "food"), eq(schema.reports.targetId, id))).orderBy(desc(schema.reports.createdAt)).limit(20),
    db.select({ n: count() }).from(schema.mealEntries).where(eq(schema.mealEntries.foodId, id)),
    db
      .select()
      .from(schema.foods)
      .where(
        and(
          ne(schema.foods.id, id),
          eq(schema.foods.isPrivate, false),
          food.barcode
            ? or(eq(schema.foods.barcode, food.barcode), sql`similarity(${schema.foods.name}, ${food.name}) > 0.55`)
            : sql`similarity(${schema.foods.name}, ${food.name}) > 0.55`,
        ),
      )
      .orderBy(sql`similarity(${schema.foods.name}, ${food.name}) desc`)
      .limit(5),
    db.select({ name: schema.brands.name }).from(schema.brands).orderBy(asc(schema.brands.name)),
  ]);
  const issues = plausibilityIssues({ kcal: food.kcal100, protein: food.protein100, carbs: food.carbs100, fat: food.fat100, sugar: food.sugar100, fiber: food.fiber100, salt: food.salt100 });
  const pending = revisions.filter((r) => r.revision.status === "pending");
  const openReports = reports.filter((r) => r.status === "open");

  return (
    <main className="page">
      <Flash message={created ? "Lebensmittel angelegt." : merged ? "Duplikat zusammengeführt." : null} />
      <Link href="/admin/foods" className="back"><Icon name="chevronRight" size={14} className="flip" />Lebensmittel</Link>
      <div className="header">
        <div className="title-with-icon">
          {food.imageUrl ? <img className="product large" src={food.imageUrl} alt="" /> : <span className="product large empty"><Icon name="leaf" size={24} /></span>}
          <div>
            <h1>{food.name}</h1>
            <p className="meta-line">
              <span className={qualityClass(food.quality)}>{QUALITY_NAMES[food.quality]}</span>
              <span>{SOURCE_NAMES[food.source]}</span>
              {food.brand && <span>{food.brand}</span>}
              {food.barcode && <span className="mono">{food.barcode}</span>}
            </p>
          </div>
        </div>
        <div className="actions">
          {food.quality !== "verified" && (
            <ActionForm action={setQualityAction} success="Als geprüft markiert.">
              <input type="hidden" name="id" value={food.id} />
              <input type="hidden" name="quality" value="verified" />
              <SubmitButton className="btn primary" icon="check" disabled={issues.length > 0} title={issues.length ? "Werte sind nicht plausibel" : undefined}>Als geprüft markieren</SubmitButton>
            </ActionForm>
          )}
          {food.quality !== "suspect" && (
            <ActionForm action={setQualityAction} success="Als verdächtig markiert.">
              <input type="hidden" name="id" value={food.id} />
              <input type="hidden" name="quality" value="suspect" />
              <SubmitButton className="btn secondary" icon="flag">Als verdächtig markieren</SubmitButton>
            </ActionForm>
          )}
        </div>
      </div>

      {issues.length > 0 && <div className="alert" role="alert"><Icon name="alert" size={16} />Nicht plausibel: {issueText(issues)}.</div>}

      <div className="detail-grid">
        <div>
          {pending.length > 0 && (
            <section className="card attention-card">
              <div className="card-head"><h2>Offene Korrekturen</h2><span className="tag warn">{pending.length}</span></div>
              <div className="card-body stack-tight">
                {pending.map(({ revision }) => (
                  <div className="revision-item" key={revision.id}>
                    <div className="diff">
                      {Object.entries(revision.changes).map(([key, value]) => (
                        <div key={key}><span className="sub">{fieldName(key)}</span>{" "}<s>{String((revision.previous ?? {})[key] ?? food[key as keyof typeof food] ?? "–")}</s> → <strong>{String(value)}</strong></div>
                      ))}
                      <span className="sub">{relative(revision.createdAt)}</span>
                    </div>
                    <div className="row-actions">
                      <ActionForm action={revisionAction} success="Korrektur abgelehnt."><input type="hidden" name="revisionId" value={revision.id} /><input type="hidden" name="decision" value="reject" /><SubmitButton className="btn secondary small">Ablehnen</SubmitButton></ActionForm>
                      <ActionForm action={revisionAction} success="Korrektur übernommen."><input type="hidden" name="revisionId" value={revision.id} /><input type="hidden" name="decision" value="apply" /><SubmitButton className="btn primary small">Übernehmen</SubmitButton></ActionForm>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
          <FoodForm food={food} brands={brands.map((b) => b.name)} />
        </div>

        <aside className="detail-side">
          <section className="card">
            <div className="card-head"><h2>Überblick</h2></div>
            <dl className="card-body facts single">
              <div><dt>Tagebucheinträge</dt><dd>{number(uses.n)}</dd></div>
              <div><dt>Bestätigungen</dt><dd>{food.confirmations}</dd></div>
              <div><dt>Offene Meldungen</dt><dd>{openReports.length}</dd></div>
              <div><dt>Angelegt</dt><dd>{dateTime(food.createdAt)}</dd></div>
              <div><dt>Zuletzt geändert</dt><dd>{relative(food.updatedAt)}</dd></div>
              {food.isPrivate && <div><dt>Sichtbarkeit</dt><dd>Privat</dd></div>}
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
                    {r.details && <span className="block full">{r.details}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {duplicates.length > 0 && (
            <section className="card">
              <div className="card-head"><h2>Mögliche Duplikate</h2></div>
              <ul className="plain-list card-body">
                {duplicates.map((d) => (
                  <li key={d.id}>
                    <div className="grow-text">
                      <Link href={`/admin/foods/${d.id}`} className="name">{d.name}</Link>
                      <span className="sub block">{d.brand ?? "ohne Marke"} · {number(d.kcal100)} kcal · {QUALITY_NAMES[d.quality]}</span>
                    </div>
                    <ActionForm
                      action={mergeFoodAction}
                      confirm={{ title: `„${food.name}“ in „${d.name}“ zusammenführen?`, text: "Tagebucheinträge, Bestätigungen und Korrekturen wandern zu diesem Eintrag; der aktuelle wird entfernt. Das lässt sich nicht rückgängig machen.", confirmLabel: "Zusammenführen", tone: "danger" }}
                    >
                      <input type="hidden" name="id" value={food.id} />
                      <input type="hidden" name="intoId" value={d.id} />
                      <SubmitButton className="btn secondary small">Hierhin</SubmitButton>
                    </ActionForm>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="card">
            <div className="card-head"><h2>Verlauf</h2></div>
            <div className="card-body">
              {revisions.length === 0 ? <p className="sub">Noch keine Änderungen.</p> : (
                <ol className="timeline">
                  {revisions.map(({ revision, admin }) => (
                    <li key={revision.id} data-status={revision.status}>
                      <strong>{Object.keys(revision.changes).map(fieldName).join(", ")}</strong>
                      <span className="sub">{revision.status === "applied" ? "übernommen" : revision.status === "rejected" ? "abgelehnt" : "offen"} · {admin ?? (revision.userId ? "Community" : "System")} · {relative(revision.createdAt)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>

          <section className="card danger-zone">
            <div className="card-head"><h2>Löschen</h2></div>
            <div className="card-body stack-tight">
              <p className="sub">Tagebucheinträge behalten Name und Werte, verlieren aber den Bezug zu diesem Eintrag.</p>
              <ActionForm action={deleteFoodAction} confirm={{ title: `„${food.name}“ löschen?`, text: "Der Eintrag verschwindet aus Suche und Barcode-Scan. Das lässt sich nicht rückgängig machen.", confirmLabel: "Löschen", tone: "danger" }}>
                <input type="hidden" name="id" value={food.id} />
                <SubmitButton className="btn danger" icon="trash">Lebensmittel löschen</SubmitButton>
              </ActionForm>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
