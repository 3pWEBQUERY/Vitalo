import { ok, route } from "@/lib/api";
import { allFlags, setting } from "@/lib/settings";

/** Public app configuration: minimum version, feature flags and safety limits. */
export const GET = route(async () => {
  return ok({
    minAppVersion: await setting("min_app_version", "1.0"),
    features: await allFlags(),
    ai: { freeDailyQuota: await setting("ai_free_daily_quota", 3), available: !(await setting("ai_kill_switch", false)) && Boolean(process.env.ANTHROPIC_API_KEY) },
    safety: {
      kcalMinimumFemale: await setting("kcal_minimum_female", 1200),
      kcalMinimumMale: await setting("kcal_minimum_male", 1500),
      maxWeeklyLossPct: await setting("max_weekly_loss_pct", 1.0),
    },
  });
});
