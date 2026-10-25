import { and, desc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { currentGoal } from "./account";
import { phraseSuggestion } from "./ai";
import { setting } from "./settings";

/**
 * Coach (PRD chapter 9): deterministic, testable rules over the data a person chose to sync.
 * The coach suggests; it never changes goals itself and never goes below the safety floor.
 */

type Day = { day: string; kcal: number; protein: number; fiber: number | null; entries: number; water: number };
type Option = { id: string; title: string; action: string; value?: number };
type Draft = { signal: string; facts: Record<string, number | string>; basis: string; options: Option[]; title: string; body: string };

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

async function days(userId: string, count: number): Promise<Day[]> {
  const since = new Date(Date.now() - count * 86400_000);
  const meals = await db.execute<{ day: string; kcal: number; protein: number; fiber: number | null; entries: number }>(sql`
    select entry_date::text as day, sum(kcal)::float as kcal, coalesce(sum(protein_g), 0)::float as protein,
           case when count(fiber_g) > 0 then sum(fiber_g)::float end as fiber, count(*)::int as entries
    from meal_entries where user_id = ${userId} and deleted_at is null and status = 'logged' and entry_date >= ${isoDay(since)}::date
    group by entry_date`);
  const water = await db.execute<{ day: string; ml: number }>(sql`
    select entry_date::text as day, sum(ml)::int as ml from water_entries
    where user_id = ${userId} and deleted_at is null and entry_date >= ${isoDay(since)}::date group by entry_date`);
  const byDay = new Map<string, Day>();
  for (let i = 0; i < count; i++) {
    const day = isoDay(new Date(Date.now() - i * 86400_000));
    byDay.set(day, { day, kcal: 0, protein: 0, fiber: null, entries: 0, water: 0 });
  }
  for (const m of meals) byDay.set(m.day, { ...(byDay.get(m.day) ?? { day: m.day, water: 0 }), kcal: m.kcal, protein: m.protein, fiber: m.fiber, entries: m.entries } as Day);
  for (const w of water) if (byDay.has(w.day)) byDay.get(w.day)!.water = w.ml;
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}

/** T = T' + 0.1 (W − T') over daily averages, then a linear fit over the last six weeks. */
async function weightTrend(userId: string) {
  const rows = await db.execute<{ day: string; kg: number }>(sql`
    select measured_at::date::text as day, avg(weight_kg)::float as kg from weight_entries
    where user_id = ${userId} and deleted_at is null and measured_at > now() - interval '120 days'
    group by 1 order by 1`);
  const points: { t: number; trend: number }[] = [];
  let trend: number | null = null;
  for (const r of rows) {
    trend = trend === null ? r.kg : trend + 0.1 * (r.kg - trend);
    points.push({ t: new Date(r.day).getTime() / 86400_000, trend });
  }
  const recent = points.filter((p) => p.t >= Date.now() / 86400_000 - 42);
  if (recent.length < 5 || recent[recent.length - 1].t - recent[0].t < 13) return { weekly: null, last: trend, spanDays: points.length ? points[points.length - 1].t - points[0].t : 0, count: points.length };
  const mx = recent.reduce((s, p) => s + p.t, 0) / recent.length;
  const my = recent.reduce((s, p) => s + p.trend, 0) / recent.length;
  const sxx = recent.reduce((s, p) => s + (p.t - mx) ** 2, 0);
  const sxy = recent.reduce((s, p) => s + (p.t - mx) * (p.trend - my), 0);
  return { weekly: sxx > 0 ? (sxy / sxx) * 7 : null, last: trend, spanDays: points[points.length - 1].t - points[0].t, count: points.length };
}

const T = {
  de: {
    tooFast: ["Ein sanfteres Tempo", "Dein Trend sinkt schneller als etwa 1 % deines Gewichts pro Woche. Ein sanfteres Tempo ist leichter durchzuhalten und schützt die Muskeln."],
    gap: ["Willkommen zurück", "Ein paar Tage ohne Einträge sind kein Problem. Starte einfach mit deiner nächsten Mahlzeit."],
    protein: ["Mehr Protein am Abend", "Dein Protein lag an {days} der letzten 7 Tage unter 80 % des Ziels. Ein proteinreiches Abendessen schliesst die Lücke und hält länger satt."],
    plateau: ["Dein Trend ist flach", "Dein Gewichtstrend hat sich seit drei Wochen kaum bewegt. Kleine, ehrliche Anpassungen wirken besser als grosse Einschnitte."],
    hunger: ["Hunger am Abend", "An {days} der letzten 7 Abende war dein Hunger gross. Mehr Kalorien und Protein am Mittag und ein ballaststoffreicheres Abendessen helfen oft."],
    weekend: ["Wochenenden sehen anders aus", "Am Wochenende isst du etwa {pct} % mehr als unter der Woche. Ein Wochenbudget lässt Raum für beides."],
    fiber: ["Mehr Gemüse", "Ballaststoffe lagen an den meisten Tagen unter 70 % des Ziels. Gemüse, Hülsenfrüchte und Vollkorn bringen Volumen ohne viele Kalorien."],
    water: ["Etwas mehr Wasser", "Wasser lag an {days} der letzten 7 Tage unter 60 % deines Ziels. Sanfte Erinnerungen über den Tag können helfen."],
  },
  en: {
    tooFast: ["A gentler pace", "Your trend is dropping faster than about 1 % of your weight per week. A gentler pace is easier to keep and protects muscle."],
    gap: ["Welcome back", "A few days without entries are fine. Just start with your next meal."],
    protein: ["More protein in the evening", "Protein was below 80 % of your target on {days} of the last 7 days. A protein-rich dinner closes the gap and keeps you full longer."],
    plateau: ["Your trend is flat", "Your weight trend has barely moved for three weeks. Small, honest adjustments work better than big cuts."],
    hunger: ["Hungry in the evening", "You felt very hungry on {days} of the last 7 evenings. More calories and protein at lunch and a dinner with more fiber often help."],
    weekend: ["Weekends look different", "On weekends you eat about {pct} % more than on weekdays. A weekly budget leaves room for both."],
    fiber: ["More vegetables", "Fiber was below 70 % of your target on most days. Vegetables, legumes and whole grains add volume without many calories."],
    water: ["A little more water", "Water was below 60 % of your goal on {days} of the last 7 days. Gentle reminders during the day can help."],
  },
} as const;

function text(locale: string, key: keyof (typeof T)["en"], facts: Record<string, number | string>) {
  const table = locale.startsWith("de") ? T.de : T.en;
  const [title, body] = table[key];
  return { title, body: body.replace(/\{(\w+)\}/g, (_, k) => String(facts[k] ?? "")) };
}

/** Evaluates the signal catalogue (PRD 9.3) for one person. */
export async function evaluate(userId: string): Promise<Draft[]> {
  const [profile] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId));
  const coachSettings = (profile?.settings?.coach ?? {}) as { enabled?: boolean; checkIns?: boolean; water?: boolean };
  if (coachSettings.enabled === false) return [];
  const locale = profile?.locale ?? "de-CH";
  const goal = await currentGoal(userId);
  const week = await days(userId, 7);
  const threeWeeks = await days(userId, 21);
  const logged = week.filter((d) => d.entries > 0);
  const weight = await weightTrend(userId);
  const drafts: Draft[] = [];
  const add = (signal: keyof (typeof T)["en"], facts: Record<string, number | string>, basis: string, options: Option[]) =>
    drafts.push({ signal, facts, basis, options, ...text(locale, signal, facts) });

  const maxLoss = await setting("max_weekly_loss_pct", 1.0);
  if (goal?.kind === "lose" && weight.weekly !== null && weight.last && weight.weekly < 0 && Math.abs(weight.weekly) > weight.last * (maxLoss / 100)) {
    add("tooFast", { weeklyKg: Number(weight.weekly.toFixed(2)) }, "weight_trend_6_weeks", [
      { id: "pace", title: "gentle_pace", action: "set_pace", value: 0 },
      { id: "keep", title: "keep", action: "acknowledge" },
    ]);
  }

  const [lastEntry] = await db.execute<{ day: string | null }>(sql`select max(entry_date)::text as day from meal_entries where user_id = ${userId} and deleted_at is null`);
  if (lastEntry?.day) {
    const gap = Math.floor((Date.now() - new Date(lastEntry.day).getTime()) / 86400_000);
    if (gap > 3) add("gap", { days: gap }, "days_without_entries", [{ id: "log", title: "log_meal", action: "open_capture" }]);
  }

  if (goal?.proteinG && logged.length >= 4) {
    const low = logged.filter((d) => d.protein < goal.proteinG! * 0.8).length;
    if (low >= 4) add("protein", { days: low, targetG: goal.proteinG }, "meals_7_days", [
      { id: "foods", title: "show_protein_foods", action: "show_protein_foods" },
      { id: "later", title: "not_now", action: "acknowledge" },
    ]);
  }

  const loggingRate = threeWeeks.filter((d) => d.entries > 0).length / 21;
  if ((goal?.kind === "lose" || goal?.kind === "gain") && weight.weekly !== null && weight.spanDays > 21 && Math.abs(weight.weekly) < 0.1 && loggingRate >= 0.7) {
    const floor = profile?.sexForCalc === "male" ? await setting("kcal_minimum_male", 1500) : await setting("kcal_minimum_female", 1200);
    const sign = goal.kind === "lose" ? -1 : 1;
    const options: Option[] = [100, 150]
      .filter((step) => sign > 0 || goal.kcalTarget - step >= floor)
      .map((step) => ({ id: `kcal${step}`, title: `${sign < 0 ? "−" : "+"}${step} kcal`, action: "adjust_kcal", value: sign * step }));
    options.push({ id: "check", title: "check_logging", action: "acknowledge" });
    add("plateau", { loggingPct: Math.round(loggingRate * 100) }, "weight_and_logging_21_days", options);
  }

  if (coachSettings.checkIns !== false) {
    const since = isoDay(new Date(Date.now() - 7 * 86400_000));
    const [row] = await db.execute<{ n: number }>(sql`select count(*)::int as n from check_ins where user_id = ${userId} and deleted_at is null and entry_date >= ${since}::date and evening_hunger >= 4`);
    if ((row?.n ?? 0) >= 4) add("hunger", { days: row.n }, "check_ins_7_days", [
      { id: "try", title: "will_try", action: "acknowledge" },
      { id: "foods", title: "show_protein_foods", action: "show_protein_foods" },
    ]);
  }

  if (coachSettings.water !== false && goal?.waterMl && logged.length >= 3) {
    const low = week.filter((d) => d.water < goal.waterMl! * 0.6).length;
    if (low >= 5) add("water", { days: low }, "water_7_days", [
      { id: "remind", title: "water_reminders", action: "enable_water_reminders" },
      { id: "later", title: "not_now", action: "acknowledge" },
    ]);
  }

  const fiberTarget = goal ? (goal.kcalTarget / 1000) * 14 : null;
  const withFiber = logged.filter((d) => d.fiber !== null);
  if (fiberTarget && withFiber.length >= 5 && withFiber.filter((d) => (d.fiber ?? 0) < fiberTarget * 0.7).length >= 5) {
    add("fiber", {}, "meals_7_days", [
      { id: "challenge", title: "start_veggie_challenge", action: "join_challenge" },
      { id: "later", title: "not_now", action: "acknowledge" },
    ]);
  }

  const weekend = logged.filter((d) => [0, 6].includes(new Date(d.day).getUTCDay()));
  const weekdays = logged.filter((d) => ![0, 6].includes(new Date(d.day).getUTCDay()));
  if (weekend.length >= 2 && weekdays.length >= 3) {
    const we = weekend.reduce((s, d) => s + d.kcal, 0) / weekend.length;
    const wd = weekdays.reduce((s, d) => s + d.kcal, 0) / weekdays.length;
    if (wd > 0 && we >= wd * 1.25) add("weekend", { pct: Math.round((we / wd - 1) * 100) }, "meals_7_days", [{ id: "ok", title: "good_to_know", action: "acknowledge" }]);
  }
  return drafts;
}

/** Nightly job: stores signals and at most one new suggestion per signal per week (CCH-01/02). */
export async function runCoachJob(): Promise<{ users: number; suggestions: number }> {
  await db.update(schema.coachSuggestions).set({ status: "expired" }).where(and(eq(schema.coachSuggestions.status, "open"), lt(schema.coachSuggestions.createdAt, new Date(Date.now() - 14 * 86400_000))));
  const active = await db.execute<{ user_id: string }>(sql`
    select distinct user_id from meal_entries where updated_at > now() - interval '30 days'
    union select distinct user_id from weight_entries where updated_at > now() - interval '30 days'`);
  let created = 0;
  for (const { user_id: userId } of active) {
    const [user] = await db.select().from(schema.users).where(and(eq(schema.users.id, userId), isNull(schema.users.deletedAt)));
    if (!user) continue;
    const drafts = await evaluate(userId);
    if (!drafts.length) continue;
    const recent = await db
      .select({ signal: schema.coachSuggestions.signal })
      .from(schema.coachSuggestions)
      .where(and(eq(schema.coachSuggestions.userId, userId), gte(schema.coachSuggestions.createdAt, new Date(Date.now() - 7 * 86400_000))));
    const seen = new Set(recent.map((r) => r.signal));
    const [profile] = await db.select({ locale: schema.profiles.locale }).from(schema.profiles).where(eq(schema.profiles.userId, userId));
    for (const draft of drafts) {
      const [signal] = await db.insert(schema.coachSignals).values({ userId, signal: draft.signal, payload: draft.facts }).returning();
      if (seen.has(draft.signal)) continue;
      const wording = await phraseSuggestion(userId, draft.signal, draft.facts, { title: draft.title, body: draft.body }, profile?.locale ?? "de-CH");
      await db.insert(schema.coachSuggestions).values({
        userId, signalId: signal.id, signal: draft.signal, title: wording.title, body: wording.body,
        options: draft.options, basis: draft.basis, facts: draft.facts,
      });
      created++;
    }
  }
  // Signals are kept for 90 days, like the coach log in the app (CCH-07).
  await db.delete(schema.coachSignals).where(lt(schema.coachSignals.computedAt, new Date(Date.now() - 90 * 86400_000)));
  return { users: active.length, suggestions: created };
}

export async function openSuggestions(userId: string) {
  return db
    .select()
    .from(schema.coachSuggestions)
    .where(and(eq(schema.coachSuggestions.userId, userId), eq(schema.coachSuggestions.status, "open")))
    .orderBy(desc(schema.coachSuggestions.createdAt))
    .limit(3);
}

/** Records the person's choice. Calorie changes are applied as a new goal version, never below the floor. */
export async function decide(userId: string, id: string, status: "accepted" | "dismissed", optionId?: string) {
  const [suggestion] = await db.select().from(schema.coachSuggestions).where(and(eq(schema.coachSuggestions.id, id), eq(schema.coachSuggestions.userId, userId)));
  if (!suggestion) return null;
  const option = suggestion.options.find((o) => o.id === optionId);
  if (status === "accepted" && option?.action === "adjust_kcal" && option.value) {
    const goal = await currentGoal(userId);
    const [profile] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId));
    if (goal) {
      const floor = profile?.sexForCalc === "male" ? await setting("kcal_minimum_male", 1500) : await setting("kcal_minimum_female", 1200);
      const kcal = Math.max(goal.kcalTarget + option.value, floor);
      await db.insert(schema.goals).values({
        ...goal, id: crypto.randomUUID(), kcalTarget: kcal, carbsG: goal.carbsG != null ? Math.max(goal.carbsG + Math.round(option.value / 4), 0) : null,
        validFrom: isoDay(new Date()), createdAt: new Date(),
      });
    }
  }
  const [updated] = await db
    .update(schema.coachSuggestions)
    .set({ status, chosenOption: optionId ?? null, decidedAt: new Date() })
    .where(eq(schema.coachSuggestions.id, id))
    .returning();
  return updated;
}

export async function coachLog(userId: string) {
  return db
    .select()
    .from(schema.coachSuggestions)
    .where(and(eq(schema.coachSuggestions.userId, userId), gte(schema.coachSuggestions.createdAt, new Date(Date.now() - 90 * 86400_000))))
    .orderBy(desc(schema.coachSuggestions.createdAt));
}

export async function deleteCoachLog(userId: string, ids?: string[]) {
  const scope = ids?.length ? and(eq(schema.coachSuggestions.userId, userId), inArray(schema.coachSuggestions.id, ids)) : eq(schema.coachSuggestions.userId, userId);
  await db.delete(schema.coachSuggestions).where(scope);
  if (!ids?.length) await db.delete(schema.coachSignals).where(eq(schema.coachSignals.userId, userId));
}
