"use client";

import { useActionState } from "react";
import { changePasswordAction, confirmTotpAction, disableTotpAction, type AccountState } from "./actions";

function Message({ state }: { state: AccountState }) {
  if (state.error) return <div className="alert" role="alert">{state.error}</div>;
  if (state.done) return <div className="alert ok" role="status">{state.done}</div>;
  return null;
}

export function PasswordForm() {
  const [state, action, pending] = useActionState<AccountState, FormData>(changePasswordAction, {});
  return (
    <form action={action} className="stack-tight">
      <Message state={state} />
      <input type="text" name="username" autoComplete="username" hidden readOnly />
      <label className="field"><span>Aktuelles Passwort</span><input type="password" name="current" autoComplete="current-password" required /></label>
      <div className="grid-2">
        <label className="field"><span>Neues Passwort</span><input type="password" name="next" autoComplete="new-password" minLength={12} required /></label>
        <label className="field"><span>Wiederholen</span><input type="password" name="repeat" autoComplete="new-password" minLength={12} required /></label>
      </div>
      <small className="sub">Mindestens 12 Zeichen. Ein Passwort-Manager erzeugt am einfachsten ein sicheres.</small>
      <div className="form-actions"><button type="submit" disabled={pending}>Passwort ändern</button></div>
    </form>
  );
}

export function ConfirmTotpForm() {
  const [state, action, pending] = useActionState<AccountState, FormData>(confirmTotpAction, {});
  return (
    <form action={action} className="inline">
      <input type="text" name="code" className="code-input small" inputMode="numeric" autoComplete="one-time-code" maxLength={7} placeholder="000000" required aria-label="Code aus der App" />
      <button type="submit" disabled={pending}>Bestätigen</button>
      <Message state={state} />
    </form>
  );
}

export function DisableTotpForm() {
  const [state, action, pending] = useActionState<AccountState, FormData>(disableTotpAction, {});
  return (
    <form action={action} className="inline">
      <input type="text" name="code" className="code-input small" inputMode="numeric" autoComplete="one-time-code" maxLength={7} placeholder="000000" required aria-label="Aktueller Code" />
      <button type="submit" className="quiet" disabled={pending}>Entfernen</button>
      <Message state={state} />
    </form>
  );
}
