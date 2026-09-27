import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeAccount, accountPayload } from "../src/lib/account-sync.ts";
import { accountSchema, questSchema } from "../src/lib/backend-schema.ts";
import { QUESTS } from "../src/data/quests.ts";
const base = {
  hiddenDemoSquadIds: [],
  hearted: [],
  comments: {},
  saved: ["a", "b"],
  completed: [],
  passed: [],
  inProgress: [],
  scheduledQuests: [],
  favoriteVibes: [],
  publicProfile: true,
  optInNearby: false,
  xp: 0,
  xpClaims: [],
  streak: 0,
  log: [],
  lastQuestDay: null,
};
test("cross-device saves preserve independent additions and removals", () => {
  const result = mergeAccount(
    base,
    { ...base, saved: ["b", "c"] },
    { ...base, saved: ["a", "b", "d"] },
  );
  assert.deepEqual(result.saved, ["b", "d", "c"]);
});
test("unchanged fields restore remote values and explicit local settings win", () => {
  assert.equal(mergeAccount(base, base, { ...base, xp: 120 }).xp, 120);
  assert.equal(mergeAccount(base, { ...base, publicProfile: false }, base).publicProfile, false);
});
test("private payload does not upload position, auth data or squad ownership", () => {
  const result = accountPayload({
    ...base,
    approximateLocation: { lat: 1, lng: 2 },
    eduEmail: "test@example.com",
    squads: [{ leaderId: "me" }],
  });
  assert(!("approximateLocation" in result));
  assert(!("eduEmail" in result));
  assert(!("squads" in result));
  assert(accountSchema.safeParse(result).success);
});
test("quest validation rejects invalid group sizes and coordinates", () => {
  assert(questSchema.safeParse(QUESTS[0]).success);
  assert(!questSchema.safeParse({ ...QUESTS[0], groupMin: 5, groupMax: 2 }).success);
  assert(
    !questSchema.safeParse({ ...QUESTS[0], location: { ...QUESTS[0].location, lat: 1000 } })
      .success,
  );
});

test("rescheduling the same quest keeps a single latest local schedule", () => {
  const b = { ...base, scheduledQuests: [{ questId: "q", when: "2026-10-01" }] };
  const l = { ...b, scheduledQuests: [{ questId: "q", when: "2026-10-02" }] };
  assert.deepEqual(mergeAccount(b, l, b).scheduledQuests, l.scheduledQuests);
});
test("simultaneous completion events do not double-award XP", () => {
  const event = { kind: "complete", refId: "q", at: 1, xp: 120, label: "Done" };
  const local = { ...base, xp: 120, completed: ["q"], log: [event] };
  const remote = { ...local, log: [{ ...event, at: 2 }] };
  assert.equal(mergeAccount(base, local, remote).xp, 120);
  assert.equal(mergeAccount(base, local, remote).log.length, 1);
});
