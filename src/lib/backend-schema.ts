import type { UserState } from "./store";
import { z } from "zod";
const id = z.string().min(1).max(100);
const ids = z.array(id).max(10000);
const vibe = z.enum([
  "chill",
  "active",
  "food",
  "creative",
  "social",
  "weird",
  "outdoors",
  "competitive",
  "late-night",
]);
export const questSchema = z
  .object({
    id,
    title: z.string().trim().min(1).max(120),
    hook: z.string().max(600),
    mission: z.string().max(6000),
    steps: z.array(z.string().min(1).max(1500)).min(1).max(30),
    vibes: z.array(vibe).min(1).max(9),
    location: z.object({
      name: z.string().max(200),
      area: z.string().max(200),
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    }),
    durationMin: z.number().int().min(1).max(10080),
    costPerPerson: z.number().min(0).max(10000),
    groupMin: z.number().int().min(1).max(1000),
    groupMax: z.number().int().min(1).max(1000),
    weirdness: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
    adventure: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
    bestTime: z.array(z.enum(["morning", "afternoon", "evening", "late"])).max(4),
    indoor: z.boolean(),
    createdBy: z.string().max(100).optional(),
    generated: z.boolean().optional(),
  })
  .refine((q) => q.groupMax >= q.groupMin, "Maximum group size must be at least the minimum");
export const commentSchema = z.object({
  id,
  author: z.string().max(60),
  text: z.string().min(1).max(2000),
  at: z.number().nonnegative(),
});
export const postSchema = z.object({
  id,
  author: z.string().max(60),
  authorId: z.string().max(100),
  questId: id,
  rating: z.number().min(0).max(10),
  ratingCount: z.number().int().min(1).max(1000),
  caption: z.string().max(3000),
  photo: z.string().max(2000000).nullable(),
  withNames: z.array(z.string().max(60)).max(1000),
  at: z.number().nonnegative(),
  hearts: z.number().int().nonnegative(),
  comments: z.array(commentSchema).max(1000),
});
export const accountSchema = z.object({
  hiddenDemoSquadIds: ids,
  hearted: ids,
  comments: z.record(z.string().max(100), z.array(commentSchema).max(1000)),
  saved: ids,
  completed: ids,
  passed: ids,
  inProgress: ids,
  scheduledQuests: z
    .array(
      z.object({ questId: id, when: z.string().max(40), endWhen: z.string().max(40).optional() }),
    )
    .max(1000),
  favoriteVibes: z.array(vibe).max(9),
  publicProfile: z.boolean(),
  optInNearby: z.boolean(),
  xp: z.number().int().nonnegative(),
  xpClaims: ids,
  streak: z.number().int().nonnegative(),
  log: z
    .array(
      z.object({
        kind: z.enum(["complete", "squad", "create", "join", "verify"]),
        xp: z.number().int().nonnegative(),
        at: z.number().nonnegative(),
        label: z.string().max(300),
        refId: id.optional(),
      }),
    )
    .max(10000),
  lastQuestDay: z.string().max(10).nullable(),
});
export type AccountPayload = Pick<
  UserState,
  | "hiddenDemoSquadIds"
  | "hearted"
  | "comments"
  | "saved"
  | "completed"
  | "passed"
  | "inProgress"
  | "scheduledQuests"
  | "favoriteVibes"
  | "publicProfile"
  | "optInNearby"
  | "xp"
  | "xpClaims"
  | "streak"
  | "log"
  | "lastQuestDay"
>;
