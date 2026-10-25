import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { client?: ReturnType<typeof postgres> };

// One connection pool per process, reused across hot reloads in development.
const client = globalForDb.client ?? postgres(process.env.DATABASE_URL ?? "postgres://localhost:5432/vitalo", { max: 10 });
if (process.env.NODE_ENV !== "production") globalForDb.client = client;

export const db = drizzle(client, { schema });
export { schema };
