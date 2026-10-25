"use client";

import { useActionState, useEffect } from "react";
import { SubmitButton, useToast } from "../../components/ui";
import { updateSettingAction, type SettingState } from "./actions";

export function SettingField({ settingKey, label, hint, value }: { settingKey: string; label: string; hint: string; value: string }) {
  const toast = useToast();
  const [state, action] = useActionState<SettingState, FormData>(updateSettingAction, {});
  useEffect(() => {
    if (state.error) toast("error", `${label}: ${state.error}`);
    else if (state.saved) toast("success", `${label} gespeichert.`);
  }, [state, toast, label]);
  return (
    <form action={action} className="setting-row">
      <input type="hidden" name="key" value={settingKey} />
      <label htmlFor={`setting-${settingKey}`}>
        <span className="name">{label}</span>
        {state.error ? <small className="error">{state.error}</small> : hint ? <small className="sub">{hint}</small> : null}
      </label>
      <input id={`setting-${settingKey}`} type="text" name="value" defaultValue={value} className="setting-input" />
      <SubmitButton className="btn secondary">Speichern</SubmitButton>
    </form>
  );
}
