"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { ActionForm, SubmitButton } from "../../components/ui";
import { sanctionAction } from "./actions";

/** Opens inline: kind, duration for suspensions and a reason the person will see. */
export function SanctionForm({ userId, targetType, targetId }: { userId: string; targetType?: string; targetId?: string }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("warning");
  if (!open) {
    return <button type="button" className="btn secondary" onClick={() => setOpen(true)}><Icon name="flag" size={15} />Sanktion …</button>;
  }
  return (
    <ActionForm
      action={sanctionAction}
      className="sanction-form"
      confirm={kind === "warning" ? undefined : { title: kind === "ban" ? "Person dauerhaft aus der Community ausschliessen?" : "Person vorübergehend sperren?", text: "Die Person sieht die Begründung und kann Einspruch erheben. Tagebuch und Konto bleiben nutzbar.", confirmLabel: "Verhängen", tone: "danger" }}
    >
      <input type="hidden" name="userId" value={userId} />
      {targetType && <input type="hidden" name="targetType" value={targetType} />}
      {targetId && <input type="hidden" name="targetId" value={targetId} />}
      <select name="kind" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Art der Sanktion">
        <option value="warning">Verwarnung</option>
        <option value="suspension">Sperre auf Zeit</option>
        <option value="ban">Ausschluss aus der Community</option>
      </select>
      {kind === "suspension" && (
        <select name="days" defaultValue="7" aria-label="Dauer">
          <option value="1">1 Tag</option>
          <option value="7">7 Tage</option>
          <option value="30">30 Tage</option>
        </select>
      )}
      <input type="text" name="reason" placeholder="Begründung (sieht die Person)" required minLength={3} maxLength={500} />
      <SubmitButton className={kind === "warning" ? "btn primary" : "btn danger-solid"}>Verhängen</SubmitButton>
      <button type="button" className="btn ghost" onClick={() => setOpen(false)}>Abbrechen</button>
    </ActionForm>
  );
}
