import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { actions, bindUser, setState, XP } from "../src/lib/store.ts";

const storage = new Map();
globalThis.window = {};
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
};
let account = 0;
function snapshot() {
  let result;
  setState((state) => {
    result = state;
    return state;
  });
  return result;
}
function hydrateAccount(saved) {
  const id = `test-${++account}`;
  if (saved) storage.set(`wego.state.v1.u.${id}`, JSON.stringify({foundersJoined: true, ...saved}));
  bindUser(id);
  return snapshot();
}
beforeEach(() => {
  storage.clear();
  hydrateAccount();
});

test("cf/dev multi-squad state preserves account identity, active ownership, friends and end times", () => {
  const state = hydrateAccount({
    name: "Ada",
    handle: "ada",
    configured: true,
    squads: [
      { id: "a", name: "Study", leaderId: "me", memberIds: ["f_1"] },
      { id: "b", name: "Walk", leaderId: "f_2", memberIds: ["f_2"] },
    ],
    activeSquadId: "b",
    friends: [{ id: "f_1", name: "Friend", email: "friend@example.com" }],
    scheduledQuests: [{ questId: "q", when: "2026-10-01T23:00", endWhen: "2026-10-02T01:00" }],
  });
  assert.equal(state.name, "Ada");
  assert.equal(state.squadLeaderId, "f_2");
  assert.deepEqual(state.squadIds, ["f_1", "f_2"]);
  assert.equal(state.friends.length, 1);
  assert.equal(state.scheduledQuests[0].endWhen, "2026-10-02T01:00");
  assert.deepEqual(state.stampsSeen, []);
});

test("overhaul single-squad state migrates without seeding or changing identity and animation markers", () => {
  const state = hydrateAccount({
    name: "Sam",
    handle: "sam",
    squadIds: ["u_alex"],
    squadLeaderId: "me",
    seedVersion: 1,
    xp: 120,
    xpSeen: 100,
    stampsSeen: ["first"],
    ranksSeen: { xp: 2 },
  });
  assert.equal(state.name, "Sam");
  assert.equal(state.squads.length, 1);
  assert.deepEqual(state.squads[0].memberIds, ["u_alex"]);
  assert.equal(state.xpSeen, 100);
  assert.deepEqual(state.stampsSeen, ["first"]);
  assert.equal(state.ranksSeen.xp, 2);
});

test("legacy save XP is removed once while real completion XP survives", () => {
  const state = hydrateAccount({
    xp: 130,
    log: [
      { kind: "save", xp: 10 },
      { kind: "complete", xp: 120 },
    ],
    xpClaims: ["save:q", "join:f"],
  });
  assert.equal(state.xp, 120);
  assert.deepEqual(state.xpClaims, ["join:f"]);
  assert.equal(state.log.length, 1);
});

test("completion and undo restore schedule including end time and award XP only once", () => {
  actions.scheduleQuest("q", "2026-10-01T23:00", "2026-10-02T01:00");
  const before = snapshot();
  assert.equal(actions.complete("q", "Quest", true), XP.complete + XP.squadBonus);
  assert.equal(actions.complete("q", "Quest", true), 0);
  actions.undoComplete("q", before);
  assert.equal(snapshot().xp, before.xp);
  assert.deepEqual(snapshot().scheduledQuests, before.scheduledQuests);
  assert.deepEqual(snapshot().completed, []);
});

test("switching accounts and signing out never copies another account state", () => {
  bindUser("one");
  actions.updateProfile({ name: "One" });
  actions.toggleSave("private");
  bindUser("two");
  assert.equal(snapshot().name, "You");
  assert.deepEqual(snapshot().saved, []);
  bindUser("one");
  assert.equal(snapshot().name, "One");
  assert.deepEqual(snapshot().saved, ["private"]);
  bindUser(null);
  assert.deepEqual(snapshot().saved, []);
});

test("squad-specific invites and member removal respect ownership", () => {
  const own = actions.createSquad("Mine");
  actions.inviteSquadMember("friend", "Friend", own);
  actions.joinFriendSquad("theirs", "Theirs", { id: "leader", name: "Leader", email: "" });
  actions.inviteSquadMember("other", "Other");
  actions.toggleSquadMember("leader");
  actions.renameSquad("theirs", "Hacked");
  assert.equal(snapshot().squadInvites.length, 1);
  assert.equal(snapshot().squadInvites[0].squadId, own);
  assert.deepEqual(snapshot().squads.find((s) => s.id === "theirs").memberIds, ["leader"]);
  assert.equal(snapshot().squads.find((s) => s.id === "theirs").name, "Theirs");
  actions.setActiveSquad(own);
  actions.joinFriendSquad("theirs", "Theirs", { id: "leader", name: "Leader", email: "" });
  assert.equal(snapshot().squadLeaderId, "leader");
});

test("location storage rounds to approximate coordinates and clears on opt-out", () => {
  actions.setApproximateLocation(44.973812, -93.231928);
  assert.deepEqual(snapshot().approximateLocation, {
    lat: 44.97,
    lng: -93.23,
    label: "Your approximate area",
  });
  actions.setPrivacy({ shareLocation: false });
  assert.equal(snapshot().approximateLocation, null);
});

test("save and undo preserve order without awarding XP", () => {
  actions.toggleSave("a");
  actions.toggleSave("b");
  actions.toggleSave("a");
  actions.toggleSave("a", 0);
  assert.deepEqual(snapshot().saved, ["a", "b"]);
  actions.undoChoice("b", "save");
  assert.deepEqual(snapshot().saved, ["a"]);
  assert.equal(snapshot().xp, 0);
});
