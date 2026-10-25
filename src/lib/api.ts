import { NextResponse, type NextRequest } from "next/server";
import { z, type ZodType } from "zod";
import { appVersionAllowed } from "./settings";

/** Error with an HTTP status and a stable code the app can switch on. */
export class ApiError extends Error {
  constructor(public status: number, public code: string, message?: string) {
    super(message ?? code);
  }
}

export const badRequest = (code = "bad_request", message?: string) => new ApiError(400, code, message);
export const unauthorized = (code = "unauthorized") => new ApiError(401, code);
export const forbidden = (code = "forbidden") => new ApiError(403, code);
export const notFound = (code = "not_found") => new ApiError(404, code);

type Handler<C> = (request: NextRequest, context: C) => Promise<Response>;

/**
 * Wraps a route: enforces the minimum app version, turns ApiErrors into JSON and
 * keeps unexpected errors out of the response (and health data out of the logs).
 */
export function route<C>(handler: Handler<C>): Handler<C> {
  return async (request, context) => {
    try {
      const version = request.headers.get("x-app-version");
      if (version && !(await appVersionAllowed(version))) throw new ApiError(426, "update_required");
      return await handler(request, context);
    } catch (error) {
      if (error instanceof ApiError) return NextResponse.json({ error: error.code, message: error.message !== error.code ? error.message : undefined }, { status: error.status });
      if (error instanceof z.ZodError) return NextResponse.json({ error: "invalid_input", issues: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) }, { status: 400 });
      console.error(`[${request.method} ${request.nextUrl.pathname}]`, error instanceof Error ? error.message : "unknown error");
      return NextResponse.json({ error: "internal_error" }, { status: 500 });
    }
  };
}

export async function body<T>(request: NextRequest, schema: ZodType<T>): Promise<T> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    throw badRequest("invalid_json");
  }
  return schema.parse(json);
}

export function query<T>(request: NextRequest, schema: ZodType<T>): T {
  return schema.parse(Object.fromEntries(request.nextUrl.searchParams));
}

export const ok = (data: unknown, status = 200) => NextResponse.json(data, { status });
export const noContent = () => new NextResponse(null, { status: 204 });

// MARK: Rate limiting

const windows = new Map<string, number[]>();

/** Sliding-window limit per key on this instance. Quotas that must hold across instances live in Postgres. */
export function rateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  const hits = (windows.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) throw new ApiError(429, "rate_limited");
  hits.push(now);
  windows.set(key, hits);
  if (windows.size > 50_000) windows.clear();
}

export function clientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}
