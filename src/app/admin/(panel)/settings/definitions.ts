import { z } from "zod";

const whole = (min: number, max: number, unit = "") =>
  z.coerce
    .number({ message: "Bitte eine Zahl eingeben." })
    .int("Bitte eine ganze Zahl eingeben.")
    .min(min, `Mindestens ${min}${unit}.`)
    .max(max, `Höchstens ${max}${unit}.`);

/** Every editable setting with its type and safe range. Health-related floors cannot go below medical guidance. */
export const SETTINGS = {
  min_app_version: { label: "Mindestversion der App", hint: "Ältere Versionen werden zum Update aufgefordert.", schema: z.string().trim().regex(/^\d+(\.\d+){0,2}$/, "Format: 1.0 oder 1.2.3") },
  ai_free_daily_quota: { label: "KI-Analysen pro Tag (Free)", hint: "", schema: whole(0, 50) },
  ai_plus_daily_quota: { label: "KI-Analysen pro Tag (Plus)", hint: "", schema: whole(0, 500) },
  kcal_minimum_female: { label: "Kalorien-Untergrenze (weiblich)", hint: "Nie unter 1200 kcal.", schema: whole(1200, 2500, " kcal") },
  kcal_minimum_male: { label: "Kalorien-Untergrenze (männlich)", hint: "Nie unter 1500 kcal.", schema: whole(1500, 3000, " kcal") },
  max_weekly_loss_pct: {
    label: "Max. Abnahme pro Woche (% Körpergewicht)",
    hint: "Höchstens 1 %.",
    schema: z.coerce.number({ message: "Bitte eine Zahl eingeben." }).min(0.25, "Mindestens 0.25 %.").max(1, "Höchstens 1 %."),
  },
} as const;
export type SettingKey = keyof typeof SETTINGS;
