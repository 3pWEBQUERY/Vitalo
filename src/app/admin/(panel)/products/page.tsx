import { redirect } from "next/navigation";

/** Scanned products are foods with a barcode; they are managed under Lebensmittel. */
export default function ProductsPage() {
  redirect("/admin/foods?barcode=1");
}
