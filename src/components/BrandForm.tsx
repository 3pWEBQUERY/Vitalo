"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { SubmitButton, useKeepValuesOnError, useToast } from "@/app/admin/components/ui";
import type { FormState } from "@/app/admin/(panel)/brands/actions";

type Props = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  brand?: { id: string; name: string; domain: string | null; aliases: string[]; isHidden: boolean; iconSrc: string | null; logoSrc: string | null; hasCustomIcon: boolean; hasCustomLogo: boolean };
  submitLabel: string;
};

export function BrandForm({ action, brand, submitLabel }: Props) {
  const [state, formAction] = useActionState(action, {});
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const capture = useKeepValuesOnError(formRef, state.error ? state : null);
  useEffect(() => {
    if (state.error) toast("error", state.error);
    else if (state.saved) toast("success", "Marke gespeichert.");
  }, [state, toast]);
  return (
    <form ref={formRef} action={formAction} onSubmit={capture} className="form">
      {brand && <input type="hidden" name="id" value={brand.id} />}
      {state.error && <div className="alert" role="alert">{state.error}</div>}

      <section className="card form-section">
        <div className="form-section-head"><h2>Marke</h2><p>Name, Website und Schreibweisen bestimmen, welche Produkte das Logo zeigen.</p></div>
        <label className="field">
          <span>Name</span>
          <input type="text" name="name" required maxLength={80} defaultValue={brand?.name} placeholder="z. B. Emmi" autoFocus={!brand} />
        </label>
        <label className="field">
          <span>Website</span>
          <input type="text" name="domain" maxLength={120} defaultValue={brand?.domain ?? ""} placeholder="emmi.com" />
          <small>Mit Website wird das Logo automatisch bei Brandfetch gesucht.</small>
        </label>
        <label className="field">
          <span>Weitere Schreibweisen</span>
          <textarea name="aliases" rows={3} defaultValue={brand?.aliases.filter((a) => a !== brand.name).join("\n")} placeholder={"Eine pro Zeile, z. B.\nEMMI SCHWEIZ AG"} />
          <small>So wie die Marke auf Verpackungen und bei Open Food Facts vorkommt. Gleiche Schreibweisen landen immer bei dieser Marke.</small>
        </label>
        <label className="check">
          <input type="checkbox" name="lookupLogo" defaultChecked={!brand} />
          <span>Logo automatisch suchen</span>
        </label>
        <label className="check">
          <input type="checkbox" name="isHidden" defaultChecked={brand?.isHidden} />
          <span>Logo in der App ausblenden</span>
        </label>
      </section>

      <section className="card form-section">
        <h2>Eigenes Logo</h2>
        <p className="sub">Hochgeladene Bilder haben Vorrang vor dem automatisch gefundenen Logo. PNG, JPEG oder WebP, höchstens 5 MB.</p>
        <div className="uploads">
          <ImageField name="icon" label="App-Icon (quadratisch)" current={brand?.iconSrc ?? null} removable={brand?.hasCustomIcon ?? false} square />
          <ImageField name="logo" label="Wortlogo (breit)" current={brand?.logoSrc ?? null} removable={brand?.hasCustomLogo ?? false} />
        </div>
      </section>

      <div className="form-actions">
        <Link href="/admin/brands" className="btn secondary">Abbrechen</Link>
        <SubmitButton className="btn primary" icon="check" pendingLabel="Speichern …">{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}

function ImageField({ name, label, current, removable, square = false }: { name: string; label: string; current: string | null; removable: boolean; square?: boolean }) {
  const [preview, setPreview] = useState<string | null>(null);
  const shown = preview ?? current;
  return (
    <div className="upload">
      <span className="upload-label">{label}</span>
      <div className={square ? "upload-preview square" : "upload-preview wide"}>
        {shown ? <img src={shown} alt="" /> : <span className="sub">Kein Bild</span>}
      </div>
      <input
        type="file"
        name={name}
        accept="image/png,image/jpeg,image/webp"
        onChange={(event) => {
          const file = event.target.files?.[0];
          setPreview(file ? URL.createObjectURL(file) : null);
        }}
      />
      {removable && !preview && (
        <label className="check small">
          <input type="checkbox" name={`remove_${name}`} />
          <span>Hochgeladenes Bild entfernen</span>
        </label>
      )}
    </div>
  );
}
