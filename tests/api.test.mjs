// Integration tests against a running server (npm run dev), using dev sign-in.
//
//   npm test                       # http://localhost:3000
//   BASE_URL=http://host:3000 npm test
//
// Every test account is deleted again at the end.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { randomUUID } from "node:crypto";

const BASE = (process.env.BASE_URL ?? "http://localhost:3000") + "/api/v1";
const run = randomUUID().slice(0, 8);
const accounts = [];

async function call(path, { token, method = "GET", body, headers = {} } = {}) {
  const response = await fetch(BASE + path, {
    method,
    headers: {
      "X-App-Version": "1.0",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined && !(body instanceof Uint8Array) ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : body instanceof Uint8Array ? body : JSON.stringify(body),
    redirect: "manual",
  });
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* binary or empty */ }
  return { status: response.status, json, response };
}

async function account(name) {
  const { status, json } = await call("/auth/dev", { method: "POST", body: { name: `${name}_${run}` } });
  assert.equal(status, 200, "dev sign-in must be available (not in production)");
  accounts.push(json.accessToken);
  await call("/me/consents", { token: json.accessToken, method: "POST", body: { kind: "community", granted: true, version: "1" } });
  return { token: json.accessToken, refresh: json.refreshToken, id: json.user.id };
}

/** Smallest valid PNG, 1×1 pixel. */
const PNG = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC", "base64"));

let a, b;
before(async () => {
  a = await account("anna");
  b = await account("ben");
});
after(async () => {
  for (const token of accounts) await call("/me", { token, method: "DELETE" });
});

describe("platform", () => {
  test("health and config", async () => {
    const health = await fetch(BASE.replace("/v1", "") + "/health");
    assert.equal(health.status, 200);
    const { json } = await call("/config");
    assert.equal(typeof json.minAppVersion, "string");
    assert.ok(json.safety.kcalMinimumFemale >= 1200);
  });

  test("outdated app versions are asked to update", async () => {
    const { status } = await call("/config", { headers: { "X-App-Version": "0.1" } });
    assert.equal(status, 426);
  });

  test("requests without a token are rejected", async () => {
    assert.equal((await call("/me")).status, 401);
    assert.equal((await call("/me", { token: "not-a-token" })).status, 401);
  });

  test("refresh tokens rotate and cannot be reused", async () => {
    const first = await call("/auth/refresh", { method: "POST", body: { refreshToken: a.refresh } });
    assert.equal(first.status, 200);
    const reused = await call("/auth/refresh", { method: "POST", body: { refreshToken: a.refresh } });
    assert.equal(reused.status, 401);
    a.token = first.json.accessToken;
    a.refresh = first.json.refreshToken;
    accounts[0] = a.token;
  });
});

describe("account and goals", () => {
  test("goals below the safety floor are refused", async () => {
    await call("/me/profile", { token: a.token, method: "PATCH", body: { sexForCalc: "female", heightCm: 168, birthYear: 1992 } });
    const low = await call("/me/goals", { token: a.token, method: "POST", body: { id: randomUUID(), kind: "lose", kcalTarget: 900, validFrom: "2026-10-25" } });
    assert.equal(low.status, 422);
    const fine = await call("/me/goals", { token: a.token, method: "POST", body: { id: randomUUID(), kind: "lose", kcalTarget: 1700, validFrom: "2026-10-25" } });
    assert.equal(fine.status, 201);
  });

  test("export contains the person's own data", async () => {
    const { status, json } = await call("/me/export", { token: a.token });
    assert.equal(status, 200);
    assert.ok(json.goals.length >= 1);
  });
});

describe("sync", () => {
  test("push, pull and deletion", async () => {
    const id = randomUUID();
    const entry = { id, entryDate: "2026-10-25", mealType: "breakfast", name: "Haferflocken", quantityG: 60, kcal: 222, source: "manual" };
    const push = await call("/sync/push", { token: a.token, method: "POST", body: { meals: [entry] } });
    assert.equal(push.status, 200);
    const pull = await call("/sync/pull", { token: a.token });
    assert.ok(pull.json.meals.some((m) => m.id === id));
    const other = await call("/sync/pull", { token: b.token });
    assert.ok(!other.json.meals.some((m) => m.id === id), "entries never leak to other accounts");
    await call("/sync/push", { token: a.token, method: "POST", body: { meals: [{ ...entry, deleted: true }] } });
    const again = await call("/sync/pull", { token: a.token });
    assert.equal(again.json.meals.find((m) => m.id === id).deleted, true);
  });
});

describe("food database", () => {
  test("search finds reference foods", async () => {
    const { json } = await call("/foods/search?q=haferflocken", { token: a.token });
    assert.ok(json.foods.length > 0);
  });

  test("implausible contributions are marked suspect", async () => {
    const { status, json } = await call("/foods", { token: a.token, method: "POST", body: { name: `Testriegel ${run}`, per100: { kcal: 50, protein: 30, carbs: 40, fat: 20 }, isPrivate: false } });
    assert.equal(status, 201);
    assert.equal(json.food.quality, "suspect");
  });
});

describe("AI guards", () => {
  test("AI requires consent", async () => {
    const { status, json } = await call("/ai/text", { token: b.token, method: "POST", body: { text: "2 Eier" } });
    assert.equal(status, 403);
    assert.equal(json.error, "ai_consent_required");
  });
});

describe("community", () => {
  let postId;

  test("profiles require age confirmation", async () => {
    const minor = await call("/community/profile", { token: a.token, method: "PUT", body: { handle: `anna${run}`, ageConfirmed: false } });
    assert.equal(minor.status, 400);
    for (const [user, handle, visibility] of [[a, `anna${run}`, "public"], [b, `ben${run}`, "followers"]]) {
      const { status } = await call("/community/profile", { token: user.token, method: "PUT", body: { handle, visibility, ageConfirmed: true } });
      assert.equal(status, 200);
    }
  });

  test("follow, post, feed, react, comment", async () => {
    assert.equal((await call(`/community/follows/${a.id}`, { token: b.token, method: "POST" })).json.status, "accepted");
    const post = await call("/community/posts", { token: a.token, method: "POST", body: { kind: "text", body: "Heute Overnight Oats ausprobiert." } });
    assert.equal(post.status, 201);
    postId = post.json.id;
    const feed = await call("/community/feed?mode=latest", { token: b.token });
    assert.ok(feed.json.posts.some((p) => p.id === postId));
    assert.equal((await call(`/community/posts/${postId}/reactions`, { token: b.token, method: "PUT", body: { kind: "clap" } })).status, 204);
    assert.equal((await call(`/community/posts/${postId}/comments`, { token: b.token, method: "POST", body: { body: "Sieht gut aus!" } })).status, 201);
  });

  test("groups: free limit and safe challenges", async () => {
    const group = await call("/community/groups", { token: a.token, method: "POST", body: { name: `Meal Prep ${run}`, visibility: "public" } });
    assert.equal(group.status, 201);
    assert.equal((await call("/community/groups", { token: a.token, method: "POST", body: { name: `Zweite ${run}` } })).status, 402);
    const weightLoss = await call(`/community/groups/${group.json.id}/challenges`, { token: a.token, method: "POST", body: { kind: "custom", title: "5 kg abnehmen", targetDays: 30, startsOn: "2026-11-01", endsOn: "2026-11-30" } });
    assert.equal(weightLoss.status, 422);
    assert.equal((await call(`/community/groups/${group.json.id}/members`, { token: b.token, method: "POST" })).json.status, "active");
    assert.equal((await call(`/community/groups/${group.json.id}/challenges`, { token: b.token, method: "POST", body: { kind: "water", title: "Wasser", targetDays: 7, startsOn: "2026-10-25", endsOn: "2026-11-01" } })).status, 403);
  });

  test("blocking hides everything both ways", async () => {
    assert.equal((await call(`/blocks/${b.id}`, { token: a.token, method: "POST", body: { kind: "block" } })).status, 204);
    assert.equal((await call(`/community/posts/${postId}`, { token: b.token })).status, 404);
    assert.equal((await call("/community/feed?mode=latest", { token: b.token })).json.posts.length, 0);
    await call(`/blocks/${b.id}`, { token: a.token, method: "DELETE" });
  });

  test("progress photos stay private", async () => {
    const upload = await call("/media?purpose=progress_photo", { token: a.token, method: "POST", body: PNG, headers: { "Content-Type": "image/png" } });
    assert.equal(upload.status, 201);
    assert.equal((await call(`/media/${upload.json.id}`, { token: a.token })).status, 200);
    assert.equal((await call(`/media/${upload.json.id}`, { token: b.token })).status, 404);
  });

  test("reports are accepted", async () => {
    assert.equal((await call("/reports", { token: b.token, method: "POST", body: { targetType: "post", targetId: postId, reason: "spam" } })).status, 201);
  });
});

describe("admin area", () => {
  test("is closed without a session", async () => {
    const response = await fetch(BASE.replace("/api/v1", "") + "/admin/brands", { redirect: "manual" });
    assert.equal(response.status, 307);
    assert.match(response.headers.get("location"), /\/admin\/login$/);
  });

  test("a forged session cookie leads to sign-in", async () => {
    const response = await fetch(BASE.replace("/api/v1", "") + "/admin/team", { redirect: "manual", headers: { Cookie: "vitalo_admin=forged" } });
    assert.equal(response.status, 307);
    assert.match(response.headers.get("location"), /\/admin\/login$/);
  });
});
