import { test } from "node:test";
import assert from "node:assert/strict";
import { ALL_QUESTS, QUESTS, getQuest } from "../src/data/quests.ts";
import { ARCHIVED_QUESTS } from "../src/data/archived-quests.ts";

test("six retired quests remain addressable without appearing in the active catalog", () => {
  assert.equal(ARCHIVED_QUESTS.length, 6);
  for (const quest of ARCHIVED_QUESTS) {
    assert.equal(getQuest(quest.id), quest);
    assert(ALL_QUESTS.includes(quest));
    assert(!QUESTS.some((active) => active.id === quest.id));
  }
  assert.equal(new Set(ALL_QUESTS.map((quest) => quest.id)).size, ALL_QUESTS.length);
});
