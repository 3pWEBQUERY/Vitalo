import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { forbidden } from "./api";

/** Scheduled jobs (Railway cron) authenticate with JOB_SECRET; locally they run without it. */
export function requireJobSecret(request: NextRequest): void {
  const expected = process.env.JOB_SECRET;
  if (!expected) {
    if (process.env.NODE_ENV === "production") throw forbidden("jobs_not_configured");
    return;
  }
  const given = request.headers.get("x-job-secret") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw forbidden("invalid_job_secret");
}
