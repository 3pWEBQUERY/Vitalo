export const QUALITY_NAMES = { verified: "Geprüft", community: "Community", unverified: "Ungeprüft", suspect: "Verdächtig" } as const;
export type Quality = keyof typeof QUALITY_NAMES;
export const SOURCE_NAMES = { off: "Open Food Facts", usda: "USDA", blv: "BLV", user: "Nutzer", partner: "Partner", editorial: "Redaktion" } as const;
export const qualityClass = (quality: Quality) => (quality === "verified" ? "tag ok" : quality === "suspect" ? "tag danger" : quality === "unverified" ? "tag warn" : "tag info");

/** Languages the app ships in; food names can be translated for each. */
export const LANGUAGES = [
  { code: "de", name: "Deutsch" },
  { code: "en", name: "Englisch" },
  { code: "fr", name: "Französisch" },
  { code: "it", name: "Italienisch" },
  { code: "es", name: "Spanisch" },
] as const;

const ISSUE_NAMES: Record<string, string> = {
  energy_mismatch: "Kalorien passen nicht zu Protein, Kohlenhydraten und Fett (mehr als 20 % Abweichung)",
  macros_exceed_100g: "Protein, Kohlenhydrate und Fett ergeben mehr als 100 g",
  sugar_exceeds_carbs: "Zucker ist höher als die Kohlenhydrate",
  energy_too_high: "mehr als 900 kcal pro 100 g",
};
export const issueText = (issues: string[]) => issues.map((i) => ISSUE_NAMES[i] ?? i).join("; ");

const FIELD_NAMES: Record<string, string> = {
  name: "Name", names: "Übersetzungen", brand: "Marke", brandId: "Markenlogo", barcode: "Barcode", imageUrl: "Bild", image: "Produktbild", quality: "Qualität", servingG: "Portion", servings: "Portionen",
  kcal100: "Kalorien", protein100: "Protein", carbs100: "Kohlenhydrate", fat100: "Fett", fiber100: "Ballaststoffe", sugar100: "Zucker", salt100: "Salz",
};
export const fieldName = (key: string) => FIELD_NAMES[key] ?? key;
