import { noContent, route } from "@/lib/api";
import { endSession, requireUser } from "@/lib/auth";

export const POST = route(async (request) => {
  const { sessionId } = await requireUser(request);
  await endSession(sessionId);
  return noContent();
});
