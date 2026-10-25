import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { noContent, notFound, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { canSeeUser, visiblePost } from "@/lib/community";
import { removeMedia } from "@/lib/media";
import { getObject } from "@/lib/storage";

/**
 * Serves an image only to people allowed to see it: the owner, viewers of a post it belongs to,
 * or of the profile it is the avatar of. Progress photos stay private (PRV-09).
 */
export const GET = route(async (request, context: { params: Promise<{ id: string }> }) => {
  const { user } = await requireUser(request);
  const id = z.uuid().parse((await context.params).id);
  const [media] = await db.select().from(schema.media).where(eq(schema.media.id, id));
  if (!media || media.purpose.startsWith("brand")) throw notFound();
  let allowed = media.ownerUserId === user.id;
  if (!allowed && media.purpose === "post") {
    const links = await db
      .select({ postId: schema.postMedia.postId })
      .from(schema.postMedia)
      .innerJoin(schema.posts, eq(schema.posts.id, schema.postMedia.postId))
      .where(and(eq(schema.postMedia.mediaId, id), isNull(schema.posts.deletedAt)));
    for (const link of links) {
      if (await visiblePost(user.id, link.postId).then(() => true, () => false)) allowed = true;
    }
    if (!allowed) {
      const [avatar] = await db.select().from(schema.communityProfiles).where(eq(schema.communityProfiles.avatarMediaId, id));
      if (avatar && (await canSeeUser(user.id, avatar.userId))) allowed = true;
    }
  }
  if (!allowed) throw notFound();
  const thumb = request.nextUrl.searchParams.get("size") === "thumb";
  const bytes = (thumb ? await getObject(`${media.storageKey}.thumb.jpg`) : null) ?? (await getObject(media.storageKey));
  if (!bytes) throw notFound();
  return new NextResponse(Buffer.from(bytes), {
    headers: { "Content-Type": thumb ? "image/jpeg" : media.contentType, "Cache-Control": "private, max-age=86400" },
  });
});

export const DELETE = route(async (request, context: { params: Promise<{ id: string }> }) => {
  const { user } = await requireUser(request);
  const id = z.uuid().parse((await context.params).id);
  const [media] = await db.select().from(schema.media).where(and(eq(schema.media.id, id), eq(schema.media.ownerUserId, user.id)));
  if (!media) throw notFound();
  await removeMedia(id);
  return noContent();
});
