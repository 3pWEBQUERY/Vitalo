import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";

let cache: { at: number; settings: Map<string, unknown>; flags: Map<string, boolean> } | null = null;

/** Settings and feature flags change rarely; read them at most every 30 seconds. */
async function load() {
  if (cache && Date.now() - cache.at < 30_000) return cache;
  // Read JSON as text and parse once; the driver would otherwise parse "1.0" into 1.
  const [settings, flags] = await Promise.all([
    db.execute<{ key: string; value: string }>(sql`select key, value::text as value from app_settings`),
    db.select().from(schema.featureFlags),
  ]);
  cache = {
    at: Date.now(),
    settings: new Map(Array.from(settings).map((row) => [row.key, JSON.parse(row.value)])),
    flags: new Map(flags.map((f) => [f.key, f.enabled])),
  };
  return cache;
}

export function invalidateSettings() {
  cache = null;
}

export async function setting<T>(key: string, fallback: T): Promise<T> {
  const value = (await load()).settings.get(key);
  if (value === undefined || value === null) return fallback;
  // Keep the fallback's type: the driver can turn "1.0" into 1.
  if (typeof fallback === "string") return String(value) as T;
  if (typeof fallback === "number") return Number(value) as T;
  if (typeof fallback === "boolean") return (value === true || value === "true") as T;
  return value as T;
}

export async function flag(key: string): Promise<boolean> {
  return (await load()).flags.get(key) ?? false;
}

export async function allFlags(): Promise<Record<string, boolean>> {
  return Object.fromEntries((await load()).flags);
}

export async function updateSetting(key: string, value: unknown): Promise<void> {
  await db.execute(sql`update app_settings set value = ${JSON.stringify(value)}::jsonb, updated_at = now() where key = ${key}`);
  invalidateSettings();
}

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export async function appVersionAllowed(version: string): Promise<boolean> {
  return compareVersions(version, await setting("min_app_version", "1.0")) >= 0;
}
