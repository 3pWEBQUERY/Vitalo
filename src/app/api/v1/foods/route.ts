import { body, ok, rateLimit, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { contributeFood, contributionInput, foodDTO } from "@/lib/foods";

/** Adds a food to the community database (or privately). Rate limited against abuse. */
export const POST = route(async (request) => {
  const { user } = await requireUser(request);
  rateLimit(`contribute:${user.id}`, 30, 60 * 60_000);
  const { food, issues } = await contributeFood(user.id, await body(request, contributionInput));
  return ok({ food: foodDTO(food), issues }, 201);
});
