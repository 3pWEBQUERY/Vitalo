import { redirect } from "next/navigation";
import { currentAdmin } from "@/lib/admin";
import { PasswordForm } from "./LoginForms";

export const dynamic = "force-dynamic";
export const metadata = { title: { absolute: "Anmelden · Vitalo Admin" } };

export default async function LoginPage() {
  if (await currentAdmin()) redirect("/admin");
  return (
    <main className="login">
      <div className="login-card">
        <img src="/site/icon.png" alt="" width={52} height={52} className="login-icon" />
        <h1>Vitalo Admin</h1>
        <p>Nur für das Vitalo-Team.</p>
        <PasswordForm />
      </div>
    </main>
  );
}
