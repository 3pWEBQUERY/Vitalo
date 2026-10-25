import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import type { Brand } from "@/db/schema";
import { removeMedia } from "./media";

/** Brands are re-resolved after this long, unless an admin set them by hand. */
const REFRESH_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
/** Below this match score we show no logo rather than a wrong one. */
const MIN_QUALITY = 0.5;

const searchResult = z.array(
  z.object({
    brandId: z.string(),
    name: z.string().nullable().optional(),
    domain: z.string(),
    qualityScore: z.number().optional(),
    verified: z.boolean().optional(),
    icon: z.string().nullable().optional(),
  }),
);

/** Lowercase, accents removed, punctuation collapsed. "Nestlé " → "nestle". */
export function brandKey(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Open Food Facts lists several brands ("ESN, Elite Sports Nutrition"); the first is the main one. */
export function primaryBrand(brands: string | null | undefined): string | null {
  const first = brands?.split(",")[0]?.trim();
  return first ? first : null;
}

function clientId(): string | undefined {
  return process.env.BRANDFETCH_CLIENT_ID || undefined;
}

/**
 * The CDN needs a client ID. Without our own (development only) we reuse the one the
 * search API puts into its own result URLs; production must set BRANDFETCH_CLIENT_ID.
 */
function cdnUrl(providerId: string, kind: "icon" | "logo", resultIcon?: string | null): string {
  const size = kind === "icon" ? "w/256/h/256" : "w/512/h/256";
  // fallback/404 makes the CDN fail instead of drawing a generic lettermark,
  // so we never show a logo that isn't the brand's own.
  const path = `https://cdn.brandfetch.io/${providerId}/${size}/fallback/404/${kind}.webp`;
  const id = clientId() ?? (resultIcon ? new URL(resultIcon).searchParams.get("c") : null);
  return id ? `${path}?c=${encodeURIComponent(id)}` : path;
}

export const usesOwnProviderKey = () => Boolean(clientId());

async function searchProvider(name: string) {
  const id = clientId();
  const url = `https://api.brandfetch.io/v2/search/${encodeURIComponent(name)}${id ? `?c=${encodeURIComponent(id)}` : ""}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!response.ok) return [];
  return searchResult.parse(await response.json());
}

/** Picks a result only if its name really is this brand, preferring verified, high-quality matches. */
function bestMatch(name: string, results: z.infer<typeof searchResult>) {
  const key = brandKey(name);
  const candidates = results.filter((result) => {
    const resultKey = brandKey(result.name ?? "");
    const domainKey = brandKey(result.domain.split(".")[0] ?? "");
    return resultKey === key || domainKey === key.replace(/ /g, "");
  });
  candidates.sort((a, b) => Number(b.verified ?? false) - Number(a.verified ?? false) || (b.qualityScore ?? 0) - (a.qualityScore ?? 0));
  const best = candidates[0];
  return best && (best.qualityScore ?? 0) >= MIN_QUALITY ? best : undefined;
}

/** Legal and organisational words that are part of company names but not of the brand. */
const COMPANY_WORDS = new Set([
  "sa", "nv", "ag", "gmbh", "mbh", "kg", "ltd", "limited", "inc", "llc", "plc", "bv", "spa", "srl", "sarl", "sas", "co", "cie",
  "company", "corp", "corporation", "group", "groupe", "gruppe", "holding", "international", "services", "service",
  "schweiz", "suisse", "svizzera", "switzerland", "deutschland", "germany", "france", "italia", "europe", "uk",
]);

/** Retailers whose own-label ranges ("Migros Bio", "Coop Naturaplan") carry the retailer's logo. */
const RETAILERS = ["migros", "coop", "denner", "volg", "spar", "manor", "aldi", "lidl", "rewe", "edeka", "dm", "carrefour", "auchan", "billa", "hofer", "conad", "esselunga", "mercadona", "tesco", "sainsbury s", "waitrose"];

/** "COCA-COLA SERVICES SA/NV" → ["COCA-COLA SERVICES SA/NV", "COCA-COLA"]; "Nutella, Ferrero" → ["Nutella", "Ferrero"]. */
export function brandVariants(raw: string): string[] {
  const variants: string[] = [];
  for (const part of raw.split(",").map((p) => p.trim()).filter(Boolean)) {
    variants.push(part);
    const words = part.split("/")[0].trim().split(/\s+/);
    while (words.length > 1 && COMPANY_WORDS.has(brandKey(words[words.length - 1]))) words.pop();
    const cleaned = words.join(" ").replace(/[.,]+$/, "");
    if (cleaned && brandKey(cleaned) !== brandKey(part)) variants.push(cleaned);
  }
  // Last resort for own-label ranges: the retailer itself.
  for (const variant of [...variants]) {
    const key = brandKey(variant);
    const retailer = RETAILERS.find((r) => key.startsWith(`${r} `));
    if (retailer) variants.push(variant.slice(0, retailer.length));
  }
  return [...new Set(variants)];
}

/** Short names stay as written (ESN); shouted names take the provider's spelling (COCA-COLA → Coca-Cola). */
function displayName(variant: string, providerName?: string | null): string {
  const shouting = variant.length > 4 && variant === variant.toUpperCase() && /[A-Z]/.test(variant);
  return shouting && providerName ? providerName : variant;
}

/** A retailer match keeps the range's own name: "Migros Bio" with the Migros logo. */
function shownName(variants: string[], matched: string): string {
  const key = brandKey(matched);
  if (!RETAILERS.includes(key)) return matched;
  return variants.find((v) => brandKey(v).startsWith(`${key} `)) ?? matched;
}

type Match = NonNullable<ReturnType<typeof bestMatch>>;

/** The provider knows many brands without an icon or wordmark; only keep images that exist. */
async function existingImage(url: string): Promise<string | null> {
  const response = await fetch(url, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(6000) }).catch(() => null);
  const ok = Boolean(response?.ok && response.headers.get("content-type")?.startsWith("image/"));
  await response?.body?.cancel().catch(() => {});
  return ok ? url : null;
}

async function providerFields(match: Match | undefined) {
  const [iconUrl, logoUrl] = match
    ? await Promise.all([existingImage(cdnUrl(match.brandId, "icon", match.icon)), existingImage(cdnUrl(match.brandId, "logo", match.icon))])
    : [null, null];
  return {
    domain: match?.domain ?? null,
    providerId: match?.brandId ?? null,
    iconUrl,
    logoUrl,
    qualityScore: match?.qualityScore ?? null,
  };
}

async function findMatch(variants: string[]): Promise<{ match?: Match; variant?: string }> {
  for (const variant of variants) {
    const match = bestMatch(variant, await searchProvider(variant));
    if (match) return { match, variant };
  }
  return {};
}

async function brandByAlias(key: string): Promise<Brand | undefined> {
  const [row] = await db
    .select({ brand: schema.brands })
    .from(schema.brandAliases)
    .innerJoin(schema.brands, eq(schema.brandAliases.brandId, schema.brands.id))
    .where(eq(schema.brandAliases.aliasKey, key))
    .limit(1);
  return row?.brand;
}

async function addAlias(brandId: string, alias: string): Promise<void> {
  const key = brandKey(alias);
  if (!key) return;
  await db
    .insert(schema.brandAliases)
    .values({ aliasKey: key, alias, brandId })
    .onConflictDoUpdate({ target: schema.brandAliases.aliasKey, set: { brandId, alias } });
}

export type ResolvedBrand = { brand: Brand; shownName: string };

/**
 * Finds the brand behind a product's brand text. Every spelling is stored as an alias,
 * so "Coca-Cola" and "COCA-COLA SERVICES SA/NV" share one brand and one logo.
 */
export async function resolveBrandFor(raw: string): Promise<ResolvedBrand> {
  const key = brandKey(raw);
  const variants = brandVariants(raw);
  const known = await brandByAlias(key);
  const stale = known && known.source !== "manual" && Date.now() - known.fetchedAt.getTime() > REFRESH_AFTER_MS;
  if (known && !stale) return { brand: known, shownName: rangeName(variants, known) };
  if (known && stale) return { brand: await refreshBrandLogo(known.id), shownName: rangeName(variants, known) };

  let found: { match?: Match; variant?: string } = {};
  try {
    found = await findMatch(variants);
  } catch {
    // Provider unreachable: store the brand without logo; the admin or the next refresh can add it.
  }
  const { match, variant } = found;
  const canonical = displayName(match && variant ? variant : (variants[1] ?? variants[0] ?? raw), match?.name);

  // Same provider entry or same name already known? Then this is just another spelling.
  let brand =
    (match ? (await db.select().from(schema.brands).where(eq(schema.brands.providerId, match.brandId)).limit(1))[0] : undefined) ??
    (await brandByAlias(brandKey(canonical)));
  if (!brand) {
    [brand] = await db
      .insert(schema.brands)
      .values({ name: canonical, nameKey: brandKey(canonical), source: match ? "brandfetch" : "none", ...(await providerFields(match)) })
      .onConflictDoUpdate({ target: schema.brands.nameKey, set: { updatedAt: new Date() } })
      .returning();
  }
  await addAlias(brand.id, raw);
  if (brandKey(canonical) !== key) await addAlias(brand.id, canonical);
  return { brand, shownName: match && variant ? displayName(shownName(variants, variant), match.name) : brand.name };
}

/** Name to show on a product: the range for retailer own-labels ("Migros Bio"), otherwise the brand. */
function rangeName(variants: string[], brand: Brand): string {
  const key = brandKey(brand.name);
  if (!RETAILERS.includes(key)) return brand.name;
  return variants.find((v) => brandKey(v).startsWith(`${key} `)) ?? brand.name;
}

export async function resolveBrand(name: string): Promise<Brand> {
  return (await resolveBrandFor(name)).brand;
}

/** Looks the brand up again at the provider, by website if one is set, otherwise by name. */
export async function refreshBrandLogo(id: string): Promise<Brand> {
  const [brand] = await db.select().from(schema.brands).where(eq(schema.brands.id, id)).limit(1);
  if (!brand) throw new Error("brand not found");
  let match: Match | undefined;
  try {
    if (brand.domain) {
      const results = await searchProvider(brand.domain);
      const hit = results.find((r) => r.domain === brand.domain);
      match = hit ? { ...hit } : undefined;
    }
    match ??= (await findMatch(brandVariants(brand.name))).match;
  } catch {
    return brand;
  }
  const [updated] = await db
    .update(schema.brands)
    .set({
      ...(await providerFields(match)),
      domain: match?.domain ?? brand.domain,
      source: brand.source === "manual" ? "manual" : match ? "brandfetch" : "none",
      fetchedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.brands.id, id))
    .returning();
  return updated;
}

// MARK: - Admin

export function cleanDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
}

export type BrandInput = {
  name: string;
  domain: string;
  aliases: string[];
  isHidden: boolean;
  lookupLogo: boolean;
};

/** Creates a brand by hand. With a website (or lookupLogo) the logo is fetched automatically. */
export async function createBrand(input: BrandInput): Promise<Brand> {
  const nameKey = brandKey(input.name);
  if (!nameKey) throw new BrandError("Bitte einen Namen eingeben.");
  if (await brandByAlias(nameKey)) throw new BrandError(`„${input.name}“ gibt es schon.`);
  const domain = cleanDomain(input.domain) || null;
  const [brand] = await db
    .insert(schema.brands)
    .values({ name: input.name.trim(), nameKey, domain, source: "manual", isHidden: input.isHidden })
    .returning();
  await setAliases(brand.id, [input.name, ...input.aliases]);
  if (domain || input.lookupLogo) return refreshBrandLogo(brand.id);
  return brand;
}

export async function updateBrand(id: string, input: BrandInput): Promise<Brand> {
  const [current] = await db.select().from(schema.brands).where(eq(schema.brands.id, id)).limit(1);
  if (!current) throw new BrandError("Diese Marke gibt es nicht mehr.");
  const nameKey = brandKey(input.name);
  if (!nameKey) throw new BrandError("Bitte einen Namen eingeben.");
  const owner = await brandByAlias(nameKey);
  if (owner && owner.id !== id) throw new BrandError(`„${input.name}“ gehört schon zur Marke ${owner.name}.`);
  for (const alias of input.aliases) {
    const other = await brandByAlias(brandKey(alias));
    if (other && other.id !== id) throw new BrandError(`Die Schreibweise „${alias}“ gehört schon zur Marke ${other.name}.`);
  }
  const domain = cleanDomain(input.domain) || null;
  await db
    .update(schema.brands)
    .set({ name: input.name.trim(), nameKey, domain, isHidden: input.isHidden, source: "manual", updatedAt: new Date() })
    .where(eq(schema.brands.id, id));
  await setAliases(id, [input.name, ...input.aliases]);
  // Food records show the brand name, so keep them in step.
  await db.update(schema.foods).set({ brand: input.name.trim() }).where(eq(schema.foods.brandId, id));
  if (input.lookupLogo || domain !== current.domain) return refreshBrandLogo(id);
  const [updated] = await db.select().from(schema.brands).where(eq(schema.brands.id, id)).limit(1);
  return updated;
}

async function setAliases(id: string, aliases: string[]): Promise<void> {
  const unique = new Map(aliases.map((a) => a.trim()).filter(Boolean).map((a) => [brandKey(a), a] as const));
  await db.delete(schema.brandAliases).where(eq(schema.brandAliases.brandId, id));
  for (const [key, alias] of unique) {
    if (key) await db.insert(schema.brandAliases).values({ aliasKey: key, alias, brandId: id }).onConflictDoNothing();
  }
}

export async function deleteBrand(id: string): Promise<void> {
  const [brand] = await db.select().from(schema.brands).where(eq(schema.brands.id, id)).limit(1);
  if (!brand) return;
  // Products keep their brand text but lose the link; aliases go with the brand.
  await db.delete(schema.brands).where(eq(schema.brands.id, id));
  for (const mediaId of [brand.customIconId, brand.customLogoId]) {
    if (mediaId) await removeMedia(mediaId);
  }
}

export class BrandError extends Error {}

export type BrandDTO = { id: string; name: string; domain: string | null; iconUrl: string | null; logoUrl: string | null };

export function hasIcon(brand: Brand): boolean {
  return !brand.isHidden && Boolean(brand.customIconId || brand.iconUrl);
}

export function hasLogo(brand: Brand): boolean {
  return !brand.isHidden && Boolean(brand.customLogoId || brand.logoUrl);
}

/** What the app sees. Image URLs point at this server, so provider keys never reach the app. */
export function brandDTO(brand: Brand, origin: string, shownName?: string): BrandDTO {
  const version = brand.updatedAt.getTime();
  return {
    id: brand.id,
    name: shownName ?? brand.name,
    domain: brand.domain,
    iconUrl: hasIcon(brand) ? `${origin}/api/v1/brands/${brand.id}/icon?v=${version}` : null,
    logoUrl: hasLogo(brand) ? `${origin}/api/v1/brands/${brand.id}/icon?kind=logo&v=${version}` : null,
  };
}

