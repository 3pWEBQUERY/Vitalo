const locale = "de-CH";
const zone = "Europe/Zurich";

export const number = (value: number, digits = 0) => new Intl.NumberFormat(locale, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
/** Small AI costs need four decimals; zero and larger sums read better with two. */
export function usd(value: number): string {
  const digits = value > 0 && value < 10 ? 4 : 2;
  return new Intl.NumberFormat(locale, { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}
export const percent = (value: number) => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }).format(value);
export const dateTime = (value: Date | null | undefined) => (value ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: zone }).format(value) : "–");
export const date = (value: Date | string | null | undefined) => (value ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: zone }).format(typeof value === "string" ? new Date(value) : value) : "–");

export function relative(value: Date | null | undefined): string {
  if (!value) return "–";
  const seconds = Math.round((value.getTime() - Date.now()) / 1000);
  const format = new Intl.RelativeTimeFormat("de", { numeric: "auto" });
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [["day", 86400], ["hour", 3600], ["minute", 60]];
  for (const [unit, size] of steps) if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
  return "gerade eben";
}

/** First characters of an ID, enough to tell entries apart in lists. */
export const shortId = (id: string) => id.slice(0, 8);
