import Link from "next/link";
import { Icon } from "@/components/Icon";
import { requireAdmin, ROLE_NAMES, ROLE_TEXT, ROLES } from "@/lib/admin";
import { StateForm, SubmitButton } from "../../../components/ui";
import { inviteAction } from "../actions";

export default async function NewMemberPage() {
  await requireAdmin("team");
  return (
    <main className="page narrow">
      <Link href="/admin/team" className="back"><Icon name="chevronRight" size={14} className="flip" />Team</Link>
      <div className="header">
        <div>
          <h1>Person aufnehmen</h1>
          <p>Die Person meldet sich mit E-Mail und Startpasswort an und richtet dann die Zwei-Faktor-Anmeldung ein.</p>
        </div>
      </div>
      <StateForm action={inviteAction} className="card form-section">
        <div className="grid-2">
          <label className="field"><span>Name</span><input type="text" name="name" required minLength={2} maxLength={80} /></label>
          <label className="field"><span>E-Mail-Adresse</span><input type="email" name="email" autoComplete="off" required /></label>
        </div>
        <fieldset className="role-picker">
          <legend className="field-label">Rolle</legend>
          {ROLES.map((role) => (
            <label key={role} className="role-option">
              <input type="radio" name="role" value={role} defaultChecked={role === "moderator"} />
              <span><strong>{ROLE_NAMES[role]}</strong><small>{ROLE_TEXT[role]}</small></span>
            </label>
          ))}
        </fieldset>
        <label className="field">
          <span>Startpasswort</span>
          <input type="password" name="password" autoComplete="new-password" minLength={12} required />
          <small>Mindestens 12 Zeichen. Persönlich oder über einen Passwort-Manager weitergeben, nie per E-Mail.</small>
        </label>
        <div className="form-actions"><SubmitButton className="btn primary" icon="plus" pendingLabel="Anlegen …">Konto anlegen</SubmitButton></div>
      </StateForm>
    </main>
  );
}
