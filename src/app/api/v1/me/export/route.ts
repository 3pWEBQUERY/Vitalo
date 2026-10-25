import { NextResponse } from "next/server";
import { z } from "zod";
import { query, rateLimit, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { exportData, toCSV } from "@/lib/account";

const tables = ["meals", "water", "weights", "checkIns"] as const;

/** Data export as JSON, or one table as CSV with ?format=csv&table=meals (PRV-03). */
export const GET = route(async (request) => {
  const { user } = await requireUser(request);
  rateLimit(`export:${user.id}`, 10, 60 * 60_000);
  const { format, table } = query(request, z.object({ format: z.enum(["json", "csv"]).default("json"), table: z.enum(tables).default("meals") }));
  const data = await exportData(user.id);
  if (format === "csv") {
    return new NextResponse(toCSV(data[table] as Record<string, unknown>[]), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="vitalo-${table}.csv"` },
    });
  }
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": 'attachment; filename="vitalo-export.json"' },
  });
});
