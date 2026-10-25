import { sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { Icon } from "@/components/Icon";
import { requireAdmin } from "@/lib/admin";
import { relative } from "@/lib/format";
import { ActionForm, StateForm, SubmitButton } from "../../components/ui";
import { createFlagAction, deleteFlagAction, toggleFlagAction, updateFlagAction } from "./actions";
import { SETTINGS, type SettingKey } from "./definitions";
import { SettingField } from "./SettingField";

export const dynamic = "force-dynamic";

const FLAG_NAMES: Record<string, string> = {
  community: "Community",
  ai_photo: "Foto-Erkennung",
  ai_text: "Texterkennung",
  coach: "Coach",
  coach_ai_wording: "Coach-Formulierung mit KI",
};

export default async function SettingsPage() {
  await requireAdmin("settings");
  const flags = await db.select().from(schema.featureFlags).orderBy(schema.featureFlags.key);
  const settings = Array.from(await db.execute<{ key: string; value: string }>(sql`select key, value::text as value from app_settings`));
  const valueOf = (key: string) => {
    const raw = settings.find((s) => s.key === key)?.value;
    if (raw === undefined) return "";
    const parsed = JSON.parse(raw);
    return typeof parsed === "string" ? parsed : String(parsed);
  };

  return (
    <main className="page">
      <div className="header">
        <div>
          <h1>Einstellungen</h1>
          <p>Wirken innerhalb von 30 Sekunden auf allen Servern, ohne neues App-Release. Jede Änderung steht im Protokoll.</p>
        </div>
      </div>

      <h2 className="section-title">Funktionen</h2>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Funktion</th><th>Beschreibung</th><th className="hide-sm">Geändert</th><th>An</th><th className="col-actions" /></tr></thead>
          <tbody>
            {flags.map((f) => {
              const core = f.key in FLAG_NAMES;
              return (
                <tr key={f.key}>
                  <td><span className="name">{FLAG_NAMES[f.key] ?? f.key}</span><span className="sub block mono">{f.key}</span></td>
                  <td>
                    <ActionForm action={updateFlagAction} className="inline-edit">
                      <input type="hidden" name="key" value={f.key} />
                      <input type="text" name="description" defaultValue={f.description} maxLength={200} aria-label={`Beschreibung von ${f.key}`} />
                      <SubmitButton className="btn icon-btn" title="Beschreibung speichern"><Icon name="check" size={16} /></SubmitButton>
                    </ActionForm>
                  </td>
                  <td className="sub hide-sm nowrap">{relative(f.updatedAt)}</td>
                  <td>
                    <ActionForm action={toggleFlagAction}>
                      <input type="hidden" name="key" value={f.key} />
                      <input type="hidden" name="enabled" value={String(!f.enabled)} />
                      <button type="submit" className={f.enabled ? "switch on" : "switch"} role="switch" aria-checked={f.enabled} aria-label={FLAG_NAMES[f.key] ?? f.key}><span /></button>
                    </ActionForm>
                  </td>
                  <td className="col-actions">
                    {core ? (
                      <span className="btn icon-btn" title="Wird von der App verwendet" aria-label="Geschützt"><Icon name="lock" size={15} /></span>
                    ) : (
                      <ActionForm action={deleteFlagAction} confirm={{ title: `Funktion „${f.key}“ löschen?`, text: "Abfragen der App erhalten danach „aus“.", confirmLabel: "Löschen", tone: "danger" }}>
                        <input type="hidden" name="key" value={f.key} />
                        <SubmitButton className="btn icon-btn danger" title="Löschen"><Icon name="trash" size={16} /></SubmitButton>
                      </ActionForm>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <StateForm action={createFlagAction} className="card form-section new-flag" resetOnSuccess>
        <div className="form-section-head" id="neue-funktion"><h2>Neue Funktion</h2><p>Für schrittweise Einführungen: Die App fragt den Schlüssel über <code>/api/v1/config</code> ab.</p></div>
        <div className="new-flag-row">
          <label className="field"><span>Schlüssel</span><input type="text" name="key" placeholder="z. B. recipes" required pattern="[a-z][a-z0-9_]{2,40}" /></label>
          <label className="field grow"><span>Beschreibung</span><input type="text" name="description" maxLength={200} placeholder="Was die Funktion steuert" /></label>
          <label className="check small"><input type="checkbox" name="enabled" />Sofort an</label>
          <SubmitButton className="btn primary" icon="plus">Anlegen</SubmitButton>
        </div>
      </StateForm>

      <h2 className="section-title">Werte</h2>
      <div className="card">
        {(Object.keys(SETTINGS) as SettingKey[]).map((key) => (
          <SettingField key={key} settingKey={key} label={SETTINGS[key].label} hint={SETTINGS[key].hint} value={valueOf(key)} />
        ))}
      </div>
    </main>
  );
}
