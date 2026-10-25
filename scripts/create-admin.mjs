// Creates the first admin account, or resets the password of an existing one.
//
//   npm run create-admin -- --email you@example.com --name "Your Name" [--role admin]
//
// The password is read from ADMIN_INITIAL_PASSWORD or generated. A generated password is
// written to .admin-password (git-ignored) instead of the terminal; change it after signing in.
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { writeFileSync } from "node:fs";
import { promisify } from "node:util";
import postgres from "postgres";

const scrypt = promisify(scryptCallback);
const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, value, index, all) => (value.startsWith("--") ? [...pairs, [value.slice(2), all[index + 1]]] : pairs), []),
);
const email = args.email?.trim().toLowerCase();
const role = args.role ?? "admin";
if (!email || !/^[^@\s]+@[^@\s]+$/.test(email)) {
  console.error("Usage: npm run create-admin -- --email you@example.com --name \"Your Name\" [--role admin|moderator|editor|support]");
  process.exit(1);
}
if (!["admin", "moderator", "editor", "support"].includes(role)) {
  console.error(`Unknown role "${role}".`);
  process.exit(1);
}

const generated = !process.env.ADMIN_INITIAL_PASSWORD;
const password = process.env.ADMIN_INITIAL_PASSWORD ?? randomBytes(15).toString("base64url");
if (password.length < 12) {
  console.error("ADMIN_INITIAL_PASSWORD needs at least 12 characters.");
  process.exit(1);
}
const salt = randomBytes(16);
const hash = await scrypt(password.normalize("NFKC"), salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
const passwordHash = `scrypt$16384$8$1$${salt.toString("base64")}$${hash.toString("base64")}`;

const sql = postgres(process.env.DATABASE_URL ?? "postgres://localhost:5432/vitalo", { max: 1 });
const [admin] = await sql`
  insert into admin_users (email, name, password_hash, role)
  values (${email}, ${args.name ?? email.split("@")[0]}, ${passwordHash}, ${role})
  on conflict (email) do update set password_hash = excluded.password_hash, failed_logins = 0, locked_until = null, disabled_at = null
  returning id, (xmax = 0) as created`;
await sql`insert into audit_log (admin_id, action, target_type, target_id, details)
  values (null, ${admin.created ? "admin.created" : "admin.password_reset"}, 'admin', ${admin.id}, ${sql.json({ via: "script", role })})`;
await sql.end();

console.log(`${admin.created ? "Created" : "Updated"} ${email} (${role}).`);
if (generated) {
  writeFileSync(".admin-password", `${email}\n${password}\n`, { mode: 0o600 });
  console.log("The password is in .admin-password. Sign in at /admin/login, set up two-factor sign-in, then delete the file.");
}
