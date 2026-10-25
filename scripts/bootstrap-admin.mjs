// Creates the first admin on deploy when ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD
// are set and that address has no account yet. Does nothing otherwise, so it is safe on every
// deploy. Remove both variables after the first sign-in.
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import postgres from "postgres";

const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
if (!email || !password) {
  console.log("bootstrap-admin: not configured, skipped");
  process.exit(0);
}
if (password.length < 12) {
  console.error("bootstrap-admin: ADMIN_BOOTSTRAP_PASSWORD needs at least 12 characters");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL ?? "postgres://localhost:5432/vitalo", { max: 1 });
const [existing] = await sql`select id from admin_users where email = ${email}`;
if (existing) {
  console.log(`bootstrap-admin: ${email} exists, skipped`);
} else {
  const scrypt = promisify(scryptCallback);
  const salt = randomBytes(16);
  const hash = await scrypt(password.normalize("NFKC"), salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  const passwordHash = `scrypt$16384$8$1$${salt.toString("base64")}$${hash.toString("base64")}`;
  const name = process.env.ADMIN_BOOTSTRAP_NAME ?? email.split("@")[0];
  const [admin] = await sql`insert into admin_users (email, name, password_hash, role) values (${email}, ${name}, ${passwordHash}, 'admin') returning id`;
  await sql`insert into audit_log (admin_id, action, target_type, target_id, details) values (null, 'admin.created', 'admin', ${admin.id}, ${sql.json({ via: "bootstrap" })})`;
  console.log(`bootstrap-admin: created ${email}`);
}
await sql.end();
