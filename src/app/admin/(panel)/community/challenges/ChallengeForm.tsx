"use client";

import { useActionState, useEffect, useRef } from "react";
import { Icon } from "@/components/Icon";
import type { schema } from "@/db";
import { SubmitButton, useKeepValuesOnError, useToast } from "../../../components/ui";
import { createChallengeAction, saveChallengeAction } from "../actions";
import { CHALLENGE_KINDS } from "../labels";

type Challenge = typeof schema.challenges.$inferSelect;

export function ChallengeForm({ challenge }: { challenge?: Challenge }) {
  const toast = useToast();
  const [state, action] = useActionState<{ error?: string; message?: string }, FormData>(challenge ? saveChallengeAction : createChallengeAction, {});
  const formRef = useRef<HTMLFormElement>(null);
  const capture = useKeepValuesOnError(formRef, state.error ? state : null);
  useEffect(() => {
    if (state.error) toast("error", state.error);
    else if (state.message) toast("success", state.message);
  }, [state, toast]);
  const today = new Date().toISOString().slice(0, 10);
  const inTwoWeeks = new Date(Date.now() + 13 * 86400_000).toISOString().slice(0, 10);

  return (
    <form ref={formRef} action={action} onSubmit={capture} className="card form-section">
      {challenge && <input type="hidden" name="id" value={challenge.id} />}
      {state.error && <div className="alert" role="alert"><Icon name="alert" size={16} />{state.error}</div>}
      <div className="form-section-head"><h2>Challenge</h2><p>Gewohnheiten statt Zahlen: Ziele zu Gewicht, Kalorien oder Fasten sind nicht erlaubt.</p></div>
      <label className="field"><span>Titel</span><input type="text" name="title" defaultValue={challenge?.title} required minLength={3} maxLength={80} placeholder="z. B. 14 Tage Gemüse zu jeder Hauptmahlzeit" /></label>
      <label className="field"><span>Beschreibung</span><textarea name="description" defaultValue={challenge?.description ?? ""} maxLength={600} rows={3} placeholder="Worum geht es, und wie zählt ein Tag?" /></label>
      <div className="grid-2">
        <label className="field">
          <span>Art</span>
          <select name="kind" defaultValue={challenge?.kind ?? "veggies"}>
            {Object.entries(CHALLENGE_KINDS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <label className="field"><span>Ziel</span><span className="unit-input"><input type="number" name="targetDays" min={1} max={90} defaultValue={challenge?.targetDays ?? 14} required /><small>Tage</small></span></label>
      </div>
      <div className="grid-2">
        <label className="field"><span>Start</span><input type="date" name="startsOn" defaultValue={challenge?.startsOn ?? today} required /></label>
        <label className="field"><span>Ende</span><input type="date" name="endsOn" defaultValue={challenge?.endsOn ?? inTwoWeeks} required /></label>
      </div>
      <div className="form-actions"><SubmitButton className="btn primary" icon="check" pendingLabel="Speichern …">{challenge ? "Speichern" : "Challenge anlegen"}</SubmitButton></div>
    </form>
  );
}
