import { ok, route } from "@/lib/api";
import { runCoachJob } from "@/lib/coach";
import { requireJobSecret } from "@/lib/jobs";
import { sendWeeklyReviewPushes } from "@/lib/push";

/** Nightly: coach signals and suggestions; on the weekly-review weekday also the review push. */
export const POST = route(async (request) => {
  requireJobSecret(request);
  const coach = await runCoachJob();
  const weekly = new Date().getUTCDay() === 0 ? await sendWeeklyReviewPushes() : { sent: 0 };
  return ok({ coach, weekly });
});
