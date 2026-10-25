"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import type { Food } from "@/db/schema";
import { SubmitButton, useKeepValuesOnError, useToast } from "../../../components/ui";
import { createFoodAction, saveFoodAction, type FoodFormState } from "../actions";
import { LANGUAGES, QUALITY_NAMES, type Quality } from "../quality";

const NUTRIENTS = [
  ["kcal100", "Energie", "kcal"],
  ["protein100", "Protein", "g"],
  ["carbs100", "Kohlenhydrate", "g"],
  ["sugar100", "davon Zucker", "g"],
  ["fat100", "Fett", "g"],
  ["fiber100", "Ballaststoffe", "g"],
  ["salt100", "Salz", "g"],
  ["servingG", "Standardportion", "g"],
] as const;

type Serving = { unit: string; grams: number | "" };

/** One form for creating and editing a food. */
export function FoodForm({ food, brands }: { food?: Food; brands: string[] }) {
  const toast = useToast();
  const [state, action] = useActionState<FoodFormState, FormData>(food ? saveFoodAction : createFoodAction, {});
  const [servings, setServings] = useState<Serving[]>(food?.servings.length ? food.servings : [{ unit: "", grams: "" }]);

  const formRef = useRef<HTMLFormElement>(null);
  const capture = useKeepValuesOnError(formRef, state.error ? state : null);
  useEffect(() => {
    if (state.error) toast("error", state.error);
    else if (state.saved) toast("success", "Änderungen gespeichert.");
  }, [state, toast]);

  return (
    <form ref={formRef} action={action} onSubmit={capture} className="form">
      {food && <input type="hidden" name="id" value={food.id} />}
      {state.error && <div className="alert" role="alert"><Icon name="alert" size={16} />{state.error}</div>}

      <section className="card form-section">
        <div className="form-section-head"><h2>Angaben</h2><p>So erscheint das Lebensmittel in der Suche und beim Scannen.</p></div>
        <label className="field"><span>Name</span><input type="text" name="name" defaultValue={food?.name} required maxLength={160} placeholder="z. B. Birchermüesli" /></label>
        <div className="grid-2">
          <label className="field">
            <span>Marke</span>
            <input type="text" name="brand" defaultValue={food?.brand ?? ""} maxLength={80} list="brand-names" placeholder="Ohne Marke" />
            <small>Ist die Marke angelegt, erscheint ihr Logo automatisch.</small>
            <datalist id="brand-names">{brands.map((b) => <option key={b} value={b} />)}</datalist>
          </label>
          <label className="field"><span>Barcode</span><input type="text" name="barcode" defaultValue={food?.barcode ?? ""} inputMode="numeric" placeholder="EAN, 8 oder 13 Ziffern" /></label>
        </div>
        <ImageUpload current={food?.imageUrl ?? null} foodId={food?.id} />
      </section>

      <section className="card form-section">
        <div className="form-section-head"><h2>Nährwerte pro 100 g</h2><p>Kalorien müssen ungefähr zu Protein, Kohlenhydraten und Fett passen (±20 %).</p></div>
        <div className="grid-4">
          {NUTRIENTS.map(([key, label, unit]) => (
            <label className="field" key={key}>
              <span>{label}</span>
              <span className="unit-input">
                <input type="number" name={key} step="0.01" min="0" defaultValue={food?.[key] ?? ""} required={key === "kcal100"} />
                <small>{unit}</small>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="card form-section">
        <div className="form-section-head"><h2>Portionen</h2><p>Einheiten, die in der App zur Auswahl stehen, etwa „Scheibe“ oder „Becher“.</p></div>
        <div className="servings">
          {servings.map((s, i) => (
            <div className="serving-row" key={i}>
              <input type="text" name="serving_unit" value={s.unit} onChange={(e) => setServings(servings.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)))} placeholder="Einheit, z. B. Scheibe" aria-label="Einheit" />
              <span className="unit-input">
                <input type="number" name="serving_grams" value={s.grams} min="0" step="0.1" onChange={(e) => setServings(servings.map((x, j) => (j === i ? { ...x, grams: e.target.value === "" ? "" : Number(e.target.value) } : x)))} aria-label="Gramm" />
                <small>g</small>
              </span>
              <button type="button" className="icon-btn danger" onClick={() => setServings(servings.length > 1 ? servings.filter((_, j) => j !== i) : [{ unit: "", grams: "" }])} aria-label="Portion entfernen"><Icon name="trash" size={16} /></button>
            </div>
          ))}
          <button type="button" className="btn ghost small" onClick={() => setServings([...servings, { unit: "", grams: "" }])}><Icon name="plus" size={14} />Portion hinzufügen</button>
        </div>
      </section>

      <section className="card form-section">
        <div className="form-section-head"><h2>Übersetzungen</h2><p>Leer gelassene Sprachen zeigen den Namen oben.</p></div>
        <div className="grid-2">
          {LANGUAGES.map((lang) => (
            <label className="field" key={lang.code}>
              <span>{lang.name}</span>
              <input type="text" name={`name_${lang.code}`} defaultValue={food?.names?.[lang.code] ?? ""} maxLength={160} />
            </label>
          ))}
        </div>
      </section>

      <section className="card form-section">
        <div className="form-section-head"><h2>Qualität</h2><p>„Geprüft“ nur, wenn die Werte mit Verpackung oder Referenzdatenbank übereinstimmen. Danach ändern nur noch Redakteure die Werte.</p></div>
        <div className="radio-row">
          {(Object.keys(QUALITY_NAMES) as Quality[]).map((q) => (
            <label key={q} className="radio">
              <input type="radio" name="quality" value={q} defaultChecked={(food?.quality ?? "verified") === q} />
              <span>{QUALITY_NAMES[q]}</span>
            </label>
          ))}
        </div>
      </section>

      <div className="form-actions sticky">
        <SubmitButton className="btn primary" pendingLabel="Speichern …" icon="check">{food ? "Änderungen speichern" : "Lebensmittel anlegen"}</SubmitButton>
      </div>
    </form>
  );
}

/** Product photo: pick or drop a file; it is stored in the bucket when the form is saved. */
/**
 * Product photo. For an existing food the photo is uploaded as soon as it is chosen; a new food
 * sends it with the form, because it has no id yet.
 */
function ImageUpload({ current, foodId }: { current: string | null; foodId?: string }) {
  const toast = useToast();
  const [stored, setStored] = useState(current);
  const [preview, setPreview] = useState<string | null>(null);
  const [remove, setRemove] = useState(false);
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const shown = remove ? null : preview ?? stored;

  // After saving the form, the stored photo becomes the current one.
  useEffect(() => {
    setStored(current);
    setPreview(null);
    setRemove(false);
  }, [current]);

  async function send(method: "POST" | "DELETE", file?: File) {
    if (!foodId) return;
    setBusy(method === "POST" ? "upload" : "remove");
    try {
      const body = file ? new FormData() : undefined;
      if (file) body!.append("image", file);
      const response = await fetch(`/admin/foods/${foodId}/image`, { method, body, credentials: "same-origin" });
      const result = (await response.json().catch(() => ({}))) as { imageUrl?: string | null; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Das Bild konnte nicht gespeichert werden.");
      setStored(result.imageUrl ?? null);
      toast("success", file ? "Bild gespeichert." : "Bild entfernt.");
    } catch (error) {
      toast("error", error instanceof Error ? error.message : "Das Bild konnte nicht gespeichert werden.");
    } finally {
      if (preview) URL.revokeObjectURL(preview);
      setPreview(null);
      if (input.current) input.current.value = "";
      setBusy(null);
    }
  }

  function choose(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
    setRemove(false);
    if (foodId) void send("POST", file);
  }

  const title = busy === "upload" ? "Wird hochgeladen …" : busy === "remove" ? "Wird entfernt …"
    : preview ? "Neues Bild ausgewählt" : stored && !remove ? "Bild ersetzen" : "Bild hochladen";

  return (
    <div className="field">
      <span>Produktbild</span>
      <div
        className="dropzone"
        data-dragging={dragging}
        aria-busy={busy !== null}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (busy || !e.dataTransfer.files.length) return;
          if (input.current && !foodId) input.current.files = e.dataTransfer.files;
          choose(e.dataTransfer.files);
        }}
      >
        <div className="dropzone-preview">{shown ? <img src={shown} alt="Produktbild" /> : <Icon name="image" size={26} />}</div>
        <div className="dropzone-text">
          <strong>{title}</strong>
          <span className="sub">PNG, JPEG oder WebP bis 5 MB. Hierher ziehen oder auswählen. {foodId ? "Wird sofort gespeichert, " : "Wird beim Speichern hochgeladen, "}verkleinert und ohne Kameradaten abgelegt.</span>
          <div className="dropzone-actions">
            {/* A label opens the file picker natively; Safari ignores click() on hidden file inputs in some cases. */}
            <label className="btn secondary small" aria-disabled={busy !== null}>
              <Icon name="image" size={14} />Datei wählen
              <input ref={input} type="file" className="file-input" name={foodId ? undefined : "image"} accept="image/png,image/jpeg,image/webp" disabled={busy !== null} onChange={(e) => choose(e.target.files)} />
            </label>
            {!busy && (preview || (stored && !remove)) && (
              <button
                type="button"
                className="btn ghost small"
                onClick={() => {
                  if (preview) {
                    URL.revokeObjectURL(preview);
                    setPreview(null);
                    if (input.current) input.current.value = "";
                  } else if (foodId) void send("DELETE");
                  else setRemove(true);
                }}
              >
                <Icon name="trash" size={14} />{preview ? "Auswahl verwerfen" : "Bild entfernen"}
              </button>
            )}
            {remove && <button type="button" className="btn ghost small" onClick={() => setRemove(false)}><Icon name="undo" size={14} />Rückgängig</button>}
          </div>
        </div>
        {remove && <input type="hidden" name="remove_image" value="on" />}
      </div>
    </div>
  );
}
