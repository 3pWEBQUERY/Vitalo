import Link from "next/link";
import { redirect } from "next/navigation";
import { pendingAdmin } from "@/lib/admin";
import { CodeForm } from "../LoginForms";

export const dynamic = "force-dynamic";
export const metadata = { title: { absolute: "Bestätigen · Vitalo Admin" } };

export default async function CodePage() {
  const admin = await pendingAdmin();
  if (!admin) redirect("/admin/login");
  return (
    <main className="login">
      <div className="login-card">
        <img src="/site/icon.png" alt="" width={52} height={52} className="login-icon" />
        <h1>Zwei-Faktor-Anmeldung</h1>
        <p>Gib den 6-stelligen Code aus deiner Authenticator-App für {admin.email} ein.</p>
        <CodeForm />
        <Link href="/admin/login" className="login-back">Anderes Konto verwenden</Link>
      </div>
    </main>
  );
}
