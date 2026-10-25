import Link from "next/link";
import { asc } from "drizzle-orm";
import { db, schema } from "@/db";
import { Icon } from "@/components/Icon";
import { requireAdmin } from "@/lib/admin";
import { FoodForm } from "../[id]/FoodForm";

export const dynamic = "force-dynamic";

export default async function NewFoodPage() {
  await requireAdmin("foods");
  const brands = await db.select({ name: schema.brands.name }).from(schema.brands).orderBy(asc(schema.brands.name));
  return (
    <main className="page narrow">
      <Link href="/admin/foods" className="back"><Icon name="chevronRight" size={14} className="flip" />Lebensmittel</Link>
      <div className="header">
        <div>
          <h1>Lebensmittel anlegen</h1>
          <p>Redaktionelle Einträge erscheinen sofort in der Suche der App.</p>
        </div>
      </div>
      <FoodForm brands={brands.map((b) => b.name)} />
    </main>
  );
}
