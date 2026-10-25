import { boolean, integer, jsonb, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const brands = pgTable("brands", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  nameKey: text("name_key").notNull().unique(),
  domain: text("domain"),
  providerId: text("provider_id"),
  iconUrl: text("icon_url"),
  logoUrl: text("logo_url"),
  source: text("source", { enum: ["brandfetch", "manual", "none"] }).notNull().default("none"),
  qualityScore: numeric("quality_score", { precision: 4, scale: 3, mode: "number" }),
  isHidden: boolean("is_hidden").notNull().default(false),
  customIconId: uuid("custom_icon_id"),
  customLogoId: uuid("custom_logo_id"),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const media = pgTable("media", {
  id: uuid("id").primaryKey().defaultRandom(),
  storageKey: text("storage_key").notNull().unique(),
  contentType: text("content_type").notNull(),
  byteSize: integer("byte_size").notNull(),
  purpose: text("purpose", { enum: ["brand_icon", "brand_logo", "post", "progress_photo", "label", "food_image"] }).notNull(),
  ownerUserId: uuid("owner_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const brandAliases = pgTable("brand_aliases", {
  aliasKey: text("alias_key").primaryKey(),
  alias: text("alias").notNull(),
  brandId: uuid("brand_id").notNull().references(() => brands.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const foods = pgTable("foods", {
  id: uuid("id").primaryKey().defaultRandom(),
  source: text("source", { enum: ["off", "usda", "blv", "user", "partner", "editorial"] }).notNull(),
  sourceRef: text("source_ref"),
  name: text("name").notNull(),
  names: jsonb("names").$type<Record<string, string>>().notNull().default({}),
  brand: text("brand"),
  brandId: uuid("brand_id").references(() => brands.id, { onDelete: "set null" }),
  barcode: text("barcode"),
  imageUrl: text("image_url"),
  imageMediaId: uuid("image_media_id"),
  servingG: numeric("serving_g", { precision: 7, scale: 2, mode: "number" }),
  kcal100: numeric("kcal_100", { precision: 7, scale: 2, mode: "number" }).notNull(),
  protein100: numeric("protein_100", { precision: 6, scale: 2, mode: "number" }),
  carbs100: numeric("carbs_100", { precision: 6, scale: 2, mode: "number" }),
  fat100: numeric("fat_100", { precision: 6, scale: 2, mode: "number" }),
  fiber100: numeric("fiber_100", { precision: 6, scale: 2, mode: "number" }),
  sugar100: numeric("sugar_100", { precision: 6, scale: 2, mode: "number" }),
  salt100: numeric("salt_100", { precision: 6, scale: 3, mode: "number" }),
  quality: text("quality", { enum: ["verified", "community", "unverified", "suspect"] }).notNull().default("community"),
  createdBy: uuid("created_by"),
  isPrivate: boolean("is_private").notNull().default(false),
  servings: jsonb("servings").$type<{ unit: string; grams: number }[]>().notNull().default([]),
  nutrients: jsonb("nutrients").$type<Record<string, number>>().notNull().default({}),
  confirmations: integer("confirmations").notNull().default(0),
  reports: integer("reports").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Brand = typeof brands.$inferSelect;
export type Food = typeof foods.$inferSelect;
export type Media = typeof media.$inferSelect;

export * from "./core";
