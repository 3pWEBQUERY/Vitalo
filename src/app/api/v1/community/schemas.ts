import { z } from "zod";

export const uuid = z.uuid();
export const handle = z.string().regex(/^[a-z0-9_.]{3,24}$/, "3–24 characters: a–z, 0–9, _ and .");
export const goalTags = z.array(z.enum(["lose", "maintain", "gain", "muscle", "vegetarian", "vegan", "running", "strength", "family", "shift_work", "beginner"])).max(6);
