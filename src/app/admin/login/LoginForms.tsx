"use client";

import { useActionState } from "react";
import { codeAction, passwordAction, type LoginState } from "./actions";

export function PasswordForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(passwordAction, {});
  return (
    <form action={action} className="login-form">
      {state.error && <div className="alert" role="alert">{state.error}</div>}
      <label className="field">
        <span>E-Mail-Adresse</span>
        <input type="email" name="email" autoComplete="username" defaultValue={state.email} required autoFocus />
      </label>
      <label className="field">
        <span>Passwort</span>
        <input type="password" name="password" autoComplete="current-password" required />
      </label>
      <button type="submit" disabled={pending}>{pending ? "Anmelden …" : "Anmelden"}</button>
    </form>
  );
}

export function CodeForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(codeAction, {});
  return (
    <form action={action} className="login-form">
      {state.error && <div className="alert" role="alert">{state.error}</div>}
      <label className="field">
        <span>Bestätigungscode</span>
        <input
          type="text"
          name="code"
          className="code-input"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]{6,7}"
          maxLength={7}
          placeholder="000000"
          required
          autoFocus
        />
      </label>
      <button type="submit" disabled={pending}>{pending ? "Prüfen …" : "Bestätigen"}</button>
    </form>
  );
}
