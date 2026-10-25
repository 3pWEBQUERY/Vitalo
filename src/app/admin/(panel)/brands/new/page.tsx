import Link from "next/link";
import { BrandForm } from "@/components/BrandForm";
import { Icon } from "@/components/Icon";
import { requireAdmin } from "@/lib/admin";
import { createBrandAction } from "../actions";

export default async function NewBrandPage() {
  await requireAdmin("brands");
  return (
    <main className="page narrow">
      <Link href="/admin/brands" className="back"><Icon name="chevronRight" size={14} className="flip" />Marken</Link>
      <div className="header">
        <div>
          <h1>Marke hinzufügen</h1>
          <p>Für Marken, die noch niemand gescannt hat, oder deren Logo du selbst festlegen willst.</p>
        </div>
      </div>
      <BrandForm action={createBrandAction} submitLabel="Marke anlegen" />
    </main>
  );
}
