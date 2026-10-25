import { and, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import sharp from "sharp";
import { db, schema } from "@/db";
import type { Post } from "@/db/schema";
import { ApiError, forbidden, notFound } from "./api";
import { moderateText } from "./ai";
import { MAX_IMAGE_BYTES, saveImage } from "./media";
import { notify } from "./push";
import { putObject } from "./storage";

/**
 * Community (PRD chapter 11): voluntary, pseudonymous, private by default. Weight, calories
 * and body measurements are never added to posts by the server.
 */

export async function requireCommunityProfile(userId: string) {
  const [profile] = await db.select().from(schema.communityProfiles).where(eq(schema.communityProfiles.userId, userId));
  if (!profile) throw new ApiError(403, "community_profile_required");
  const [sanction] = await db
    .select()
    .from(schema.userSanctions)
    .where(and(eq(schema.userSanctions.userId, userId), or(eq(schema.userSanctions.kind, "ban"), and(eq(schema.userSanctions.kind, "suspension"), sql`${schema.userSanctions.until} > now()`))))
    .limit(1);
  if (sanction) throw new ApiError(403, sanction.kind === "ban" ? "community_banned" : "community_suspended", sanction.until?.toISOString());
  return profile;
}

/** Everyone the viewer has blocked or who blocked the viewer: they see nothing of each other (MOD-02). */
async function hiddenUsers(viewerId: string): Promise<string[]> {
  const rows = await db
    .select({ a: schema.blocks.blockerId, b: schema.blocks.blockedId, kind: schema.blocks.kind })
    .from(schema.blocks)
    .where(or(eq(schema.blocks.blockerId, viewerId), and(eq(schema.blocks.blockedId, viewerId), eq(schema.blocks.kind, "block"))));
  return [...new Set(rows.map((r) => (r.a === viewerId ? r.b : r.a)))];
}

export async function canSeeUser(viewerId: string, ownerId: string): Promise<boolean> {
  if (viewerId === ownerId) return true;
  if ((await hiddenUsers(viewerId)).includes(ownerId)) return false;
  const [profile] = await db.select().from(schema.communityProfiles).where(eq(schema.communityProfiles.userId, ownerId));
  if (!profile) return false;
  if (profile.visibility === "public") return true;
  if (profile.visibility === "private") return false;
  const [follow] = await db.select().from(schema.follows).where(and(eq(schema.follows.followerId, viewerId), eq(schema.follows.followeeId, ownerId), eq(schema.follows.status, "accepted")));
  return Boolean(follow);
}

// MARK: - Media

/** Re-encodes uploads: strips EXIF/location, caps size, normalises orientation (PRD 11.4). */
export async function processUpload(bytes: Uint8Array, ownerUserId: string, purpose: "post" | "progress_photo" | "label") {
  if (bytes.byteLength > MAX_IMAGE_BYTES * 2) throw new ApiError(413, "image_too_large");
  let clean: Buffer;
  try {
    clean = await sharp(bytes).rotate().resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  } catch {
    throw new ApiError(400, "unsupported_image");
  }
  const media = await saveImage(new Uint8Array(clean), purpose, ownerUserId);
  const thumbnail = await sharp(clean).resize({ width: 480, height: 480, fit: "inside" }).jpeg({ quality: 75 }).toBuffer();
  await putObject(`${media.storageKey}.thumb.jpg`, new Uint8Array(thumbnail), "image/jpeg");
  return media;
}

// MARK: - Posts

export type PostInput = {
  kind: Post["kind"];
  body?: string | null;
  visibility: Post["visibility"];
  groupId?: string | null;
  mediaIds: string[];
  attachment?: Record<string, unknown> | null;
};

const SUPPORT_CATEGORIES = new Set(["eating_disorder", "extreme_diet"]);

export async function createPost(userId: string, input: PostInput) {
  const profile = await requireCommunityProfile(userId);
  if (input.groupId) {
    const [member] = await db.select().from(schema.groupMembers).where(and(eq(schema.groupMembers.groupId, input.groupId), eq(schema.groupMembers.userId, userId), eq(schema.groupMembers.status, "active")));
    if (!member) throw forbidden("not_a_group_member");
  }
  if (input.mediaIds.length) {
    const owned = await db.select({ id: schema.media.id }).from(schema.media).where(and(inArray(schema.media.id, input.mediaIds), eq(schema.media.ownerUserId, userId)));
    if (owned.length !== input.mediaIds.length) throw forbidden("media_not_owned");
  }
  const moderation = await moderateText(userId, input.body ?? "");
  // Photos always pass through review when no automatic image check is configured.
  const needsReview = moderation.decision === "review";
  const [post] = await db
    .insert(schema.posts)
    .values({
      userId,
      groupId: input.groupId ?? null,
      kind: input.kind,
      body: input.body ?? null,
      attachment: input.attachment ?? null,
      visibility: input.groupId ? "group" : profile.visibility === "public" ? input.visibility : input.visibility === "public" ? "followers" : input.visibility,
      status: needsReview ? "held" : "published",
      moderation: { ...moderation, checkedAt: new Date().toISOString() },
    })
    .returning();
  for (const [position, mediaId] of input.mediaIds.entries()) {
    await db.insert(schema.postMedia).values({ postId: post.id, mediaId, position });
  }
  return {
    post,
    // MOD-05: point to support services instead of publishing.
    showSupportResources: moderation.categories.some((c) => SUPPORT_CATEGORIES.has(c)),
  };
}

export async function deletePost(userId: string, postId: string) {
  const [post] = await db.select().from(schema.posts).where(eq(schema.posts.id, postId));
  if (!post || post.userId !== userId) throw notFound();
  await db.update(schema.posts).set({ deletedAt: new Date() }).where(eq(schema.posts.id, postId));
}

async function decoratePosts(viewerId: string, posts: Post[]) {
  if (!posts.length) return [];
  const ids = posts.map((p) => p.id);
  const authors = await db.select().from(schema.communityProfiles).where(inArray(schema.communityProfiles.userId, [...new Set(posts.map((p) => p.userId))]));
  const media = await db.select().from(schema.postMedia).where(inArray(schema.postMedia.postId, ids));
  const mine = await db.select().from(schema.reactions).where(and(inArray(schema.reactions.postId, ids), eq(schema.reactions.userId, viewerId)));
  const counts = await db.execute<{ post_id: string; kind: string; n: number }>(sql`select post_id, kind, count(*)::int as n from reactions where post_id in ${ids} group by post_id, kind`);
  return posts.map((p) => {
    const author = authors.find((a) => a.userId === p.userId);
    return {
      id: p.id,
      kind: p.kind,
      body: p.body,
      attachment: p.attachment,
      visibility: p.visibility,
      groupId: p.groupId,
      status: p.status,
      createdAt: p.createdAt,
      author: author ? { userId: author.userId, handle: author.handle, avatarUrl: author.avatarMediaId ? `/api/v1/media/${author.avatarMediaId}` : null } : null,
      media: media.filter((m) => m.postId === p.id).sort((a, b) => a.position - b.position).map((m) => ({ url: `/api/v1/media/${m.mediaId}`, thumbnailUrl: `/api/v1/media/${m.mediaId}?size=thumb` })),
      reactions: Object.fromEntries(Array.from(counts).filter((c) => c.post_id === p.id).map((c) => [c.kind, c.n])),
      myReaction: mine.find((r) => r.postId === p.id)?.kind ?? null,
      commentCount: p.commentCount,
      isMine: p.userId === viewerId,
    };
  });
}

/**
 * Feed: own posts, accepted follows and joined groups; chronological or popular,
 * keyset-paginated, computed on read (fan-out on read, PRD 11.4).
 */
export async function feed(viewerId: string, options: { cursor?: string; mode: "latest" | "popular"; groupId?: string; limit: number }) {
  const hidden = await hiddenUsers(viewerId);
  let cursorDate: Date | null = null;
  let cursorId: string | null = null;
  if (options.cursor) {
    const [date, id] = Buffer.from(options.cursor, "base64url").toString().split("|");
    cursorDate = new Date(date);
    cursorId = id;
  }
  const scope = options.groupId
    ? sql`p.group_id = ${options.groupId} and exists (select 1 from group_members m where m.group_id = p.group_id and m.user_id = ${viewerId} and m.status = 'active')`
    : sql`(p.user_id = ${viewerId}
          or (p.group_id is null and p.visibility in ('followers','public') and exists (select 1 from follows f where f.follower_id = ${viewerId} and f.followee_id = p.user_id and f.status = 'accepted'))
          or (p.group_id is not null and exists (select 1 from group_members m where m.group_id = p.group_id and m.user_id = ${viewerId} and m.status = 'active')))`;
  const hiddenClause = hidden.length ? sql`and p.user_id not in ${hidden}` : sql``;
  const cursorClause = cursorDate && cursorId ? sql`and (p.created_at, p.id) < (${cursorDate.toISOString()}::timestamptz, ${cursorId}::uuid)` : sql``;
  const order = options.mode === "popular"
    ? sql`order by (p.reaction_count + 2 * p.comment_count) / power(extract(epoch from now() - p.created_at) / 3600 + 2, 1.5) desc, p.created_at desc, p.id desc`
    : sql`order by p.created_at desc, p.id desc`;
  const rows = await db.execute<{ id: string }>(sql`
    select p.id from posts p
    where p.deleted_at is null and (p.status = 'published' or p.user_id = ${viewerId}) and ${scope} ${hiddenClause}
    ${options.mode === "latest" ? cursorClause : sql``}
    and p.created_at > now() - interval '180 days'
    ${order}
    limit ${options.limit + 1}`);
  const ids = Array.from(rows).map((r) => r.id);
  const hasMore = ids.length > options.limit;
  const page = ids.slice(0, options.limit);
  const posts = page.length ? await db.select().from(schema.posts).where(inArray(schema.posts.id, page)) : [];
  posts.sort((a, b) => page.indexOf(a.id) - page.indexOf(b.id));
  const last = posts[posts.length - 1];
  return {
    posts: await decoratePosts(viewerId, posts),
    nextCursor: hasMore && last && options.mode === "latest" ? Buffer.from(`${last.createdAt.toISOString()}|${last.id}`).toString("base64url") : null,
  };
}

export async function visiblePost(viewerId: string, postId: string) {
  const [post] = await db.select().from(schema.posts).where(and(eq(schema.posts.id, postId), isNull(schema.posts.deletedAt)));
  if (!post) throw notFound();
  if (post.userId === viewerId) return post;
  if (post.status !== "published") throw notFound();
  if (post.groupId) {
    const [member] = await db.select().from(schema.groupMembers).where(and(eq(schema.groupMembers.groupId, post.groupId), eq(schema.groupMembers.userId, viewerId), eq(schema.groupMembers.status, "active")));
    if (!member) throw notFound();
  } else if (!(await canSeeUser(viewerId, post.userId))) {
    throw notFound();
  }
  return post;
}

export async function react(viewerId: string, postId: string, kind: "heart" | "clap" | "strong" | null) {
  await requireCommunityProfile(viewerId);
  const post = await visiblePost(viewerId, postId);
  const [existing] = await db.select().from(schema.reactions).where(and(eq(schema.reactions.postId, postId), eq(schema.reactions.userId, viewerId)));
  if (kind === null) {
    if (existing) {
      await db.delete(schema.reactions).where(and(eq(schema.reactions.postId, postId), eq(schema.reactions.userId, viewerId)));
      await db.update(schema.posts).set({ reactionCount: sql`greatest(${schema.posts.reactionCount} - 1, 0)` }).where(eq(schema.posts.id, postId));
    }
    return;
  }
  await db.insert(schema.reactions).values({ postId, userId: viewerId, kind }).onConflictDoUpdate({ target: [schema.reactions.postId, schema.reactions.userId], set: { kind } });
  if (!existing) {
    await db.update(schema.posts).set({ reactionCount: sql`${schema.posts.reactionCount} + 1` }).where(eq(schema.posts.id, postId));
    if (post.userId !== viewerId) await notifyAs(post.userId, "reaction", viewerId);
  }
}

async function notifyAs(recipientId: string, kind: "reaction" | "comment" | "follow", actorId: string) {
  const [actor] = await db.select({ handle: schema.communityProfiles.handle }).from(schema.communityProfiles).where(eq(schema.communityProfiles.userId, actorId));
  await notify(recipientId, kind, actor?.handle ?? "").catch(() => 0);
}

export async function comments(viewerId: string, postId: string) {
  await visiblePost(viewerId, postId);
  const hidden = await hiddenUsers(viewerId);
  const rows = await db
    .select({ comment: schema.comments, handle: schema.communityProfiles.handle })
    .from(schema.comments)
    .leftJoin(schema.communityProfiles, eq(schema.communityProfiles.userId, schema.comments.userId))
    .where(and(eq(schema.comments.postId, postId), isNull(schema.comments.deletedAt), or(eq(schema.comments.status, "published"), eq(schema.comments.userId, viewerId))))
    .orderBy(schema.comments.createdAt)
    .limit(500);
  return rows
    .filter((r) => !hidden.includes(r.comment.userId))
    .map((r) => ({ id: r.comment.id, parentId: r.comment.parentId, body: r.comment.body, status: r.comment.status, createdAt: r.comment.createdAt, author: r.handle, isMine: r.comment.userId === viewerId }));
}

export async function addComment(viewerId: string, postId: string, body: string, parentId?: string | null) {
  await requireCommunityProfile(viewerId);
  const post = await visiblePost(viewerId, postId);
  const moderation = await moderateText(viewerId, body);
  const [comment] = await db
    .insert(schema.comments)
    .values({ postId, userId: viewerId, parentId: parentId ?? null, body, status: moderation.decision === "review" ? "held" : "published" })
    .returning();
  if (comment.status === "published") {
    await db.update(schema.posts).set({ commentCount: sql`${schema.posts.commentCount} + 1` }).where(eq(schema.posts.id, postId));
    if (post.userId !== viewerId) await notifyAs(post.userId, "comment", viewerId);
  }
  return { comment, showSupportResources: moderation.categories.some((c) => SUPPORT_CATEGORIES.has(c)) };
}

// MARK: - Follows

export async function follow(viewerId: string, targetId: string) {
  await requireCommunityProfile(viewerId);
  if (viewerId === targetId) throw new ApiError(422, "cannot_follow_self");
  if ((await hiddenUsers(viewerId)).includes(targetId)) throw notFound();
  const [target] = await db.select().from(schema.communityProfiles).where(eq(schema.communityProfiles.userId, targetId));
  if (!target) throw notFound();
  const status = target.visibility === "public" ? "accepted" : "pending";
  await db.insert(schema.follows).values({ followerId: viewerId, followeeId: targetId, status }).onConflictDoNothing();
  if (status === "accepted") await notifyAs(targetId, "follow", viewerId);
  return { status };
}

export async function answerFollowRequest(ownerId: string, followerId: string, accept: boolean) {
  if (accept) {
    await db.update(schema.follows).set({ status: "accepted" }).where(and(eq(schema.follows.followerId, followerId), eq(schema.follows.followeeId, ownerId)));
    await notifyAs(followerId, "follow", ownerId);
  } else {
    await db.delete(schema.follows).where(and(eq(schema.follows.followerId, followerId), eq(schema.follows.followeeId, ownerId)));
  }
}

// MARK: - Like-minded people (COM-08)

export async function suggestions(viewerId: string, limit = 20) {
  const [me] = await db.select().from(schema.communityProfiles).where(eq(schema.communityProfiles.userId, viewerId));
  if (!me?.discoverable) return [];
  const hidden = await hiddenUsers(viewerId);
  const rows = await db.execute<{ user_id: string; handle: string; bio: string | null; goal_tags: string[]; overlap: number }>(sql`
    select c.user_id, c.handle, c.bio, c.goal_tags,
      cardinality(array(select unnest(c.goal_tags) intersect select unnest(${me.goalTags}::text[])))
      + case when c.region is not null and c.region = ${me.region} then 1 else 0 end as overlap
    from community_profiles c
    where c.discoverable and c.user_id <> ${viewerId} and c.visibility <> 'private'
      and not exists (select 1 from follows f where f.follower_id = ${viewerId} and f.followee_id = c.user_id)
    order by overlap desc, c.created_at desc
    limit ${limit + hidden.length}`);
  return Array.from(rows).filter((r) => !hidden.includes(r.user_id)).slice(0, limit).map((r) => ({ userId: r.user_id, handle: r.handle, bio: r.bio, goalTags: r.goal_tags }));
}

// MARK: - Reports (MOD-01)

/** Three open reports hide a post or comment until a moderator looks at it. */
export async function report(reporterId: string, input: { targetType: "post" | "comment" | "user" | "group" | "food"; targetId: string; reason: (typeof schema.reports.$inferInsert)["reason"]; details?: string | null }) {
  await db.insert(schema.reports).values({ reporterId, targetType: input.targetType, targetId: input.targetId, reason: input.reason, details: input.details ?? null });
  const [{ n }] = await db.execute<{ n: number }>(sql`select count(distinct reporter_id)::int as n from reports where target_type = ${input.targetType} and target_id = ${input.targetId} and status = 'open'`);
  if (n >= 3) {
    if (input.targetType === "post") await db.update(schema.posts).set({ status: "held" }).where(eq(schema.posts.id, input.targetId));
    if (input.targetType === "comment") await db.update(schema.comments).set({ status: "held" }).where(eq(schema.comments.id, input.targetId));
    if (input.targetType === "food") await db.update(schema.foods).set({ quality: "suspect", reports: n }).where(eq(schema.foods.id, input.targetId));
  }
}

// MARK: - Groups

export async function joinGroup(userId: string, groupId: string) {
  await requireCommunityProfile(userId);
  const [group] = await db.select().from(schema.communityGroups).where(and(eq(schema.communityGroups.id, groupId), eq(schema.communityGroups.status, "active")));
  if (!group) throw notFound();
  if (group.visibility === "invite") {
    const [invite] = await db.select().from(schema.groupMembers).where(and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, userId), eq(schema.groupMembers.status, "invited")));
    if (!invite) throw forbidden("invite_only");
    await db.update(schema.groupMembers).set({ status: "active" }).where(and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, userId)));
    return { status: "active" };
  }
  const status = group.visibility === "public" ? "active" : "requested";
  await db.insert(schema.groupMembers).values({ groupId, userId, status }).onConflictDoNothing();
  return { status };
}

export async function groupRole(userId: string, groupId: string) {
  const [member] = await db.select().from(schema.groupMembers).where(and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, userId), eq(schema.groupMembers.status, "active")));
  return member?.role ?? null;
}

/** Group challenge progress: a person marks a day; the server checks it lies within the challenge. */
/** Challenges Vitalo always runs; the app shows them in the person's language (titles here are the German default). */
export const STANDARD_CHALLENGES = [
  { kind: "veggies", title: "7 Tage Gemüse", description: "Eine Woche lang jeden Tag Gemüse eintragen.", targetDays: 7 },
  { kind: "water", title: "7 Tage Wasser", description: "Eine Woche lang jeden Tag dein Wasserziel erreichen.", targetDays: 7 },
  { kind: "protein", title: "Protein an 5 von 7 Tagen", description: "An fünf Tagen dein Proteinziel erreichen.", targetDays: 5 },
  { kind: "breakfast", title: "30 Tage Frühstück", description: "30 Tage lang dein Frühstück eintragen.", targetDays: 30 },
] as const;

/** Keeps one open Vitalo challenge per standard kind, each running for 90 days. */
export async function ensureStandardChallenges(today: string) {
  for (const standard of STANDARD_CHALLENGES) {
    const [open] = await db.execute<{ id: string }>(sql`
      select id from challenges
      where group_id is null and kind = ${standard.kind} and title = ${standard.title}
        and ends_on >= (${today}::date + ${standard.targetDays * 2}::int)
      limit 1`);
    if (open) continue;
    await db.execute(sql`
      insert into challenges (kind, title, description, target_days, starts_on, ends_on)
      values (${standard.kind}, ${standard.title}, ${standard.description}, ${standard.targetDays}, ${today}::date, ${today}::date + 90)`);
  }
}

export async function markChallengeDay(userId: string, challengeId: string, day: string) {
  const [challenge] = await db.select().from(schema.challenges).where(eq(schema.challenges.id, challengeId));
  if (!challenge) throw notFound();
  if (challenge.groupId && !(await groupRole(userId, challenge.groupId))) throw forbidden("not_a_group_member");
  if (day < challenge.startsOn || day > challenge.endsOn) throw new ApiError(422, "day_outside_challenge");
  await db.insert(schema.challengeProgress).values({ challengeId, userId, day }).onConflictDoNothing();
  const [{ n }] = await db.execute<{ n: number }>(sql`select count(*)::int as n from challenge_progress where challenge_id = ${challengeId} and user_id = ${userId}`);
  return { days: n, target: challenge.targetDays, completed: n >= challenge.targetDays };
}

export async function cleanupExpiredHolds() {
  // Held content older than 30 days without a decision is removed.
  await db.update(schema.posts).set({ status: "removed" }).where(and(eq(schema.posts.status, "held"), lt(schema.posts.createdAt, new Date(Date.now() - 30 * 86400_000))));
}

