import { sql } from "drizzle-orm";
import { bigint, boolean, date, integer, jsonb, numeric, pgTable, primaryKey, smallint, text, timestamp, uuid } from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true });
const num = (name: string, precision: number, scale: number) => numeric(name, { precision, scale, mode: "number" });

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  appleSub: text("apple_sub").unique(),
  appleRefreshToken: text("apple_refresh_token"),
  email: text("email"),
  plan: text("plan", { enum: ["free", "plus"] }).notNull().default("free"),
  planExpiresAt: ts("plan_expires_at"),
  lockedAt: ts("locked_at"),
  lockReason: text("lock_reason"),
  createdAt: ts("created_at").notNull().defaultNow(),
  deletedAt: ts("deleted_at"),
});

export const profiles = pgTable("profiles", {
  userId: uuid("user_id").primaryKey(),
  displayName: text("display_name"),
  birthYear: smallint("birth_year"),
  sexForCalc: text("sex_for_calc", { enum: ["female", "male"] }),
  bodyType: text("body_type", { enum: ["female", "male", "neutral"] }).notNull().default("neutral"),
  heightCm: num("height_cm", 5, 1),
  activityLevel: text("activity_level"),
  dietType: text("diet_type"),
  allergens: text("allergens").array().notNull().default(sql`'{}'`),
  units: text("units").notNull().default("metric"),
  locale: text("locale").notNull().default("de-CH"),
  protectionMode: boolean("protection_mode").notNull().default(false),
  settings: jsonb("settings").$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const goals = pgTable("goals", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull(),
  kind: text("kind", { enum: ["lose", "maintain", "gain", "muscle", "custom"] }).notNull(),
  targetWeightKg: num("target_weight_kg", 5, 2),
  targetDate: date("target_date"),
  pace: text("pace"),
  kcalTarget: integer("kcal_target").notNull(),
  proteinG: integer("protein_g"),
  carbsG: integer("carbs_g"),
  fatG: integer("fat_g"),
  waterMl: integer("water_ml"),
  validFrom: date("valid_from").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const deviceSessions = pgTable("device_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  refreshHash: text("refresh_hash").notNull().unique(),
  deviceName: text("device_name"),
  appVersion: text("app_version"),
  createdAt: ts("created_at").notNull().defaultNow(),
  lastUsedAt: ts("last_used_at").notNull().defaultNow(),
  expiresAt: ts("expires_at").notNull(),
  revokedAt: ts("revoked_at"),
});

export const consents = pgTable("consents", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  kind: text("kind", { enum: ["healthData", "aiProcessing", "appleHealth", "notifications", "community", "healthSync"] }).notNull(),
  granted: boolean("granted").notNull(),
  version: text("version").notNull(),
  textHash: text("text_hash"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const mealEntries = pgTable("meal_entries", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull(),
  entryDate: date("entry_date").notNull(),
  mealType: text("meal_type", { enum: ["breakfast", "lunch", "dinner", "snack"] }).notNull(),
  status: text("status", { enum: ["logged", "planned"] }).notNull().default("logged"),
  foodId: uuid("food_id"),
  nameSnapshot: text("name_snapshot").notNull(),
  quantityG: num("quantity_g", 8, 2).notNull(),
  servingUnit: text("serving_unit"),
  servingCount: num("serving_count", 6, 2),
  kcal: num("kcal", 7, 1).notNull(),
  proteinG: num("protein_g", 6, 1),
  carbsG: num("carbs_g", 6, 1),
  fatG: num("fat_g", 6, 1),
  fiberG: num("fiber_g", 6, 1),
  sugarG: num("sugar_g", 6, 1),
  saltG: num("salt_g", 6, 2),
  category: text("category"),
  source: text("source", { enum: ["manual", "barcode", "photo_ai", "text_ai", "label", "recipe", "copy", "quick"] }).notNull(),
  aiConfidence: num("ai_confidence", 3, 2),
  updatedAt: ts("updated_at").notNull().defaultNow(),
  deletedAt: ts("deleted_at"),
});

export const waterEntries = pgTable("water_entries", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull(),
  entryDate: date("entry_date").notNull(),
  loggedAt: ts("logged_at").notNull(),
  ml: integer("ml").notNull(),
  drinkType: text("drink_type").notNull().default("water"),
  updatedAt: ts("updated_at").notNull().defaultNow(),
  deletedAt: ts("deleted_at"),
});

export const weightEntries = pgTable("weight_entries", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull(),
  measuredAt: ts("measured_at").notNull(),
  weightKg: num("weight_kg", 5, 2).notNull(),
  bodyFatPct: num("body_fat_pct", 4, 1),
  leanMassKg: num("lean_mass_kg", 5, 2),
  waistCm: num("waist_cm", 5, 1),
  hipCm: num("hip_cm", 5, 1),
  source: text("source", { enum: ["manual", "healthkit", "scale"] }).notNull().default("manual"),
  updatedAt: ts("updated_at").notNull().defaultNow(),
  deletedAt: ts("deleted_at"),
});

export const checkIns = pgTable("check_ins", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull(),
  entryDate: date("entry_date").notNull(),
  hunger: smallint("hunger"),
  satiety: smallint("satiety"),
  mood: smallint("mood"),
  energy: smallint("energy"),
  sleep: smallint("sleep"),
  eveningHunger: smallint("evening_hunger"),
  updatedAt: ts("updated_at").notNull().defaultNow(),
  deletedAt: ts("deleted_at"),
});

export const foodConfirmations = pgTable("food_confirmations", {
  foodId: uuid("food_id").notNull(),
  userId: uuid("user_id").notNull(),
  kcal100: num("kcal_100", 7, 2).notNull(),
  protein100: num("protein_100", 6, 2),
  carbs100: num("carbs_100", 6, 2),
  fat100: num("fat_100", 6, 2),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.foodId, t.userId] })]);

export const foodRevisions = pgTable("food_revisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  foodId: uuid("food_id").notNull(),
  userId: uuid("user_id"),
  adminId: uuid("admin_id"),
  changes: jsonb("changes").$type<Record<string, unknown>>().notNull(),
  previous: jsonb("previous").$type<Record<string, unknown>>(),
  status: text("status", { enum: ["pending", "applied", "rejected"] }).notNull().default("pending"),
  createdAt: ts("created_at").notNull().defaultNow(),
  decidedAt: ts("decided_at"),
});

export const aiRequests = pgTable("ai_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id"),
  kind: text("kind", { enum: ["photo", "text", "label", "coach", "moderation"] }).notNull(),
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  cacheReadTokens: integer("cache_read_tokens").notNull().default(0),
  costUsd: num("cost_usd", 10, 6).notNull().default(0),
  durationMs: integer("duration_ms").notNull().default(0),
  status: text("status", { enum: ["ok", "error", "rejected", "timeout"] }).notNull(),
  error: text("error"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const coachSignals = pgTable("coach_signals", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  signal: text("signal").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  computedAt: ts("computed_at").notNull().defaultNow(),
});

export const coachSuggestions = pgTable("coach_suggestions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  signalId: uuid("signal_id"),
  signal: text("signal").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  options: jsonb("options").$type<{ id: string; title: string; action: string; value?: number }[]>().notNull().default([]),
  basis: text("basis").notNull(),
  facts: jsonb("facts").$type<Record<string, number | string>>().notNull().default({}),
  status: text("status", { enum: ["open", "accepted", "dismissed", "expired"] }).notNull().default("open"),
  chosenOption: text("chosen_option"),
  createdAt: ts("created_at").notNull().defaultNow(),
  decidedAt: ts("decided_at"),
});

export const pushTokens = pgTable("push_tokens", {
  token: text("token").primaryKey(),
  userId: uuid("user_id").notNull(),
  environment: text("environment", { enum: ["production", "sandbox"] }).notNull().default("production"),
  locale: text("locale"),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const subscriptions = pgTable("subscriptions", {
  userId: uuid("user_id").primaryKey(),
  productId: text("product_id").notNull(),
  originalTransactionId: text("original_transaction_id").notNull().unique(),
  status: text("status", { enum: ["active", "grace", "expired", "revoked", "refunded"] }).notNull(),
  expiresAt: ts("expires_at"),
  environment: text("environment").notNull(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const appStoreEvents = pgTable("app_store_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  notificationUuid: text("notification_uuid").unique(),
  notificationType: text("notification_type").notNull(),
  subtype: text("subtype"),
  originalTransactionId: text("original_transaction_id"),
  payload: jsonb("payload").notNull(),
  receivedAt: ts("received_at").notNull().defaultNow(),
});

export const communityProfiles = pgTable("community_profiles", {
  userId: uuid("user_id").primaryKey(),
  handle: text("handle").notNull().unique(),
  bio: text("bio"),
  avatarMediaId: uuid("avatar_media_id"),
  visibility: text("visibility", { enum: ["private", "followers", "public"] }).notNull().default("followers"),
  goalTags: text("goal_tags").array().notNull().default(sql`'{}'`),
  discoverable: boolean("discoverable").notNull().default(false),
  region: text("region"),
  ageConfirmedAt: ts("age_confirmed_at").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const communityGroups = pgTable("community_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  rules: text("rules"),
  visibility: text("visibility", { enum: ["public", "private", "invite"] }).notNull().default("public"),
  ownerId: uuid("owner_id").notNull(),
  status: text("status", { enum: ["active", "suspended", "removed"] }).notNull().default("active"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const groupMembers = pgTable("group_members", {
  groupId: uuid("group_id").notNull(),
  userId: uuid("user_id").notNull(),
  role: text("role", { enum: ["admin", "moderator", "member"] }).notNull().default("member"),
  status: text("status", { enum: ["active", "invited", "requested"] }).notNull().default("active"),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.groupId, t.userId] })]);

export const posts = pgTable("posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  groupId: uuid("group_id"),
  kind: text("kind", { enum: ["text", "photo", "meal", "progress", "milestone", "recipe"] }).notNull(),
  body: text("body"),
  attachment: jsonb("attachment").$type<Record<string, unknown>>(),
  visibility: text("visibility", { enum: ["followers", "public", "group"] }).notNull().default("followers"),
  status: text("status", { enum: ["pending", "published", "held", "removed"] }).notNull().default("pending"),
  moderation: jsonb("moderation").$type<Record<string, unknown>>(),
  reactionCount: integer("reaction_count").notNull().default(0),
  commentCount: integer("comment_count").notNull().default(0),
  createdAt: ts("created_at").notNull().defaultNow(),
  deletedAt: ts("deleted_at"),
});

export const postMedia = pgTable("post_media", {
  postId: uuid("post_id").notNull(),
  mediaId: uuid("media_id").notNull(),
  position: smallint("position").notNull().default(0),
}, (t) => [primaryKey({ columns: [t.postId, t.mediaId] })]);

export const reactions = pgTable("reactions", {
  postId: uuid("post_id").notNull(),
  userId: uuid("user_id").notNull(),
  kind: text("kind", { enum: ["heart", "clap", "strong"] }).notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.postId, t.userId] })]);

export const comments = pgTable("comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  postId: uuid("post_id").notNull(),
  userId: uuid("user_id").notNull(),
  parentId: uuid("parent_id"),
  body: text("body").notNull(),
  status: text("status", { enum: ["published", "held", "removed"] }).notNull().default("published"),
  createdAt: ts("created_at").notNull().defaultNow(),
  deletedAt: ts("deleted_at"),
});

export const follows = pgTable("follows", {
  followerId: uuid("follower_id").notNull(),
  followeeId: uuid("followee_id").notNull(),
  status: text("status", { enum: ["accepted", "pending"] }).notNull().default("accepted"),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.followerId, t.followeeId] })]);

export const blocks = pgTable("blocks", {
  blockerId: uuid("blocker_id").notNull(),
  blockedId: uuid("blocked_id").notNull(),
  kind: text("kind", { enum: ["block", "mute"] }).notNull().default("block"),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.blockerId, t.blockedId] })]);

export const challenges = pgTable("challenges", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id"),
  kind: text("kind", { enum: ["veggies", "water", "protein", "breakfast", "steps", "custom"] }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  targetDays: integer("target_days").notNull(),
  startsOn: date("starts_on").notNull(),
  endsOn: date("ends_on").notNull(),
  createdBy: uuid("created_by"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const challengeProgress = pgTable("challenge_progress", {
  challengeId: uuid("challenge_id").notNull(),
  userId: uuid("user_id").notNull(),
  day: date("day").notNull(),
}, (t) => [primaryKey({ columns: [t.challengeId, t.userId, t.day] })]);

export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  reporterId: uuid("reporter_id"),
  targetType: text("target_type", { enum: ["post", "comment", "user", "group", "food"] }).notNull(),
  targetId: uuid("target_id").notNull(),
  reason: text("reason", { enum: ["spam", "harassment", "eating_disorder", "body_shaming", "extreme_diet", "advertising", "wrong_values", "inappropriate", "other"] }).notNull(),
  details: text("details"),
  status: text("status", { enum: ["open", "actioned", "dismissed"] }).notNull().default("open"),
  resolvedBy: uuid("resolved_by"),
  resolvedAt: ts("resolved_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const userSanctions = pgTable("user_sanctions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  kind: text("kind", { enum: ["warning", "suspension", "ban"] }).notNull(),
  reason: text("reason").notNull(),
  until: ts("until"),
  adminId: uuid("admin_id"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const appeals = pgTable("appeals", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  sanctionId: uuid("sanction_id"),
  body: text("body").notNull(),
  status: text("status", { enum: ["open", "granted", "denied"] }).notNull().default("open"),
  decidedBy: uuid("decided_by"),
  createdAt: ts("created_at").notNull().defaultNow(),
  decidedAt: ts("decided_at"),
});

export const adminUsers = pgTable("admin_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  totpSecret: text("totp_secret"),
  totpEnabled: boolean("totp_enabled").notNull().default(false),
  role: text("role", { enum: ["admin", "moderator", "editor", "support"] }).notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
  lastLoginAt: ts("last_login_at"),
  disabledAt: ts("disabled_at"),
  failedLogins: integer("failed_logins").notNull().default(0),
  lockedUntil: ts("locked_until"),
  totpLastStep: bigint("totp_last_step", { mode: "number" }),
});

export const adminSessions = pgTable("admin_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  adminId: uuid("admin_id").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  ip: text("ip"),
  userAgent: text("user_agent"),
  createdAt: ts("created_at").notNull().defaultNow(),
  lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
  expiresAt: ts("expires_at").notNull(),
});

export const auditLog = pgTable("audit_log", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  adminId: uuid("admin_id"),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: text("target_id"),
  details: jsonb("details").$type<Record<string, unknown>>(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const featureFlags = pgTable("feature_flags", {
  key: text("key").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  description: text("description").notNull().default(""),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  description: text("description").notNull().default(""),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type AdminUser = typeof adminUsers.$inferSelect;
export type Post = typeof posts.$inferSelect;
