import { desc, eq } from "drizzle-orm";
import QRCode from "qrcode";
import { db, schema } from "@/db";
import { currentAdmin, openSecret, requireAdmin, ROLE_NAMES, totpURI, twoFactorRequired } from "@/lib/admin";
import { dateTime, relative } from "@/lib/format";
import { ActionForm, SubmitButton } from "../../components/ui";
import { endOtherSessionsAction, startTotpAction } from "./actions";
import { ConfirmTotpForm, DisableTotpForm, PasswordForm } from "./AccountForms";

export const dynamic = "force-dynamic";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ setup?: string }> }) {
  const admin = await requireAdmin("account");
  const { setup } = await searchParams;
  const context = await currentAdmin();
  const sessions = await db.select().from(schema.adminSessions).where(eq(schema.adminSessions.adminId, admin.id)).orderBy(desc(schema.adminSessions.lastSeenAt));
  const settingUp = !admin.totpEnabled && admin.totpSecret;
  const secret = settingUp ? openSecret(admin.totpSecret!) : null;
  const qr = secret ? await QRCode.toString(totpURI(secret, admin.email), { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#1c1c1e", light: "#ffffff" } }) : null;

  return (
    <main className="page narrow">
      <div className="header">
        <div>
          <h1>Mein Konto</h1>
          <p>{admin.name} · {admin.email} · {ROLE_NAMES[admin.role]}</p>
        </div>
      </div>
      {setup === "2fa" && <div className="alert" role="alert">Bitte zuerst die Zwei-Faktor-Anmeldung einrichten. Danach ist der Admin-Bereich freigeschaltet.</div>}

      <section className="card form-section">
        <h2>Zwei-Faktor-Anmeldung</h2>
        {admin.totpEnabled ? (
          <>
            <p><span className="tag ok">Aktiv</span> Bei jeder Anmeldung wird zusätzlich ein Code aus der Authenticator-App abgefragt.</p>
            {!twoFactorRequired() && <><p className="sub">Lokal kannst du sie mit einem aktuellen Code wieder entfernen.</p><DisableTotpForm /></>}
          </>
        ) : settingUp ? (
          <div className="totp-setup">
            <div className="qr" dangerouslySetInnerHTML={{ __html: qr! }} aria-label="QR-Code für die Authenticator-App" />
            <div className="stack-tight">
              <ol className="steps">
                <li>Authenticator-App öffnen (z. B. Passwörter auf dem iPhone, 1Password, Google Authenticator).</li>
                <li>QR-Code scannen oder den Schlüssel manuell eingeben.</li>
                <li>Den angezeigten 6-stelligen Code hier bestätigen.</li>
              </ol>
              <code className="secret">{secret!.match(/.{1,4}/g)!.join(" ")}</code>
              <ConfirmTotpForm />
            </div>
          </div>
        ) : (
          <>
            <p className="sub">Schützt den Admin-Zugang auch dann, wenn das Passwort bekannt wird. {twoFactorRequired() ? "Im Produktivbetrieb Pflicht." : "Im Produktivbetrieb Pflicht, lokal optional."}</p>
            <ActionForm action={startTotpAction}><SubmitButton className="btn primary" icon="key">Einrichten</SubmitButton></ActionForm>
          </>
        )}
      </section>

      <section className="card form-section">
        <h2>Passwort</h2>
        <PasswordForm />
      </section>

      <section className="card form-section">
        <h2>Angemeldete Geräte</h2>
        <ul className="plain-list">
          {sessions.map((s) => (
            <li key={s.id}>
              <span>
                {s.userAgent?.match(/(Safari|Chrome|Firefox|Edg)\/[\d.]+/)?.[0]?.replace("/", " ") ?? "Browser"}
                {s.id === context?.sessionId && <span className="tag ok">Dieses Gerät</span>}
              </span>
              <span className="sub">{s.ip ?? "lokal"} · seit {dateTime(s.createdAt)} · aktiv {relative(s.lastSeenAt)}</span>
            </li>
          ))}
        </ul>
        {sessions.length > 1 && <ActionForm action={endOtherSessionsAction} success="Andere Geräte abgemeldet."><SubmitButton className="btn secondary" icon="logout">Andere Geräte abmelden</SubmitButton></ActionForm>}
      </section>
    </main>
  );
}
