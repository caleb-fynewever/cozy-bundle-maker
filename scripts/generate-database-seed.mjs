import { FRIEND_POSTS } from "../src/data/feed.ts";
import { writeFileSync } from "node:fs";
import { QUESTS, ALL_QUESTS } from "../src/data/quests.ts";
import { NEARBY_STUDENTS, FOUNDERS_SQUAD } from "../src/data/people.ts";
const sql = (v) => "'" + JSON.stringify(v).replaceAll("'", "''") + "'::jsonb";
const str = (v) => "'" + v.replaceAll("'", "''") + "'";
const active = new Set(QUESTS.map((q) => q.id));
const lines = ["-- Generated from src/data by scripts/generate-database-seed.mjs. Safe to rerun."];
for (const p of NEARBY_STUDENTS)
  lines.push(
    `INSERT INTO public.demo_people(id,handle,name,data) VALUES (${str(p.id)},${str(p.handle)},${str(p.name)},${sql(p)}) ON CONFLICT(id) DO UPDATE SET handle=excluded.handle,name=excluded.name,data=excluded.data;`,
  );
for (const q of ALL_QUESTS)
  lines.push(
    `INSERT INTO public.quests(id,archived,content) VALUES (${str(q.id)},${!active.has(q.id)},${sql(q)}) ON CONFLICT(id) DO NOTHING;`,
  );
lines.push(
  `INSERT INTO public.demo_squads(id,name,leader_id) VALUES (${str(FOUNDERS_SQUAD.id)},${str(FOUNDERS_SQUAD.name)},${str(FOUNDERS_SQUAD.leaderId)}) ON CONFLICT(id) DO NOTHING;`,
);
for (const id of FOUNDERS_SQUAD.memberIds)
  lines.push(
    `INSERT INTO public.demo_squad_members(squad_id,person_id) VALUES (${str(FOUNDERS_SQUAD.id)},${str(id)}) ON CONFLICT DO NOTHING;`,
  );
for (const p of FRIEND_POSTS)
  lines.push(
    `INSERT INTO public.feed_posts(id,demo_id,quest_id,content,created_at) VALUES (${str(p.id)},${str(p.authorId)},${str(p.questId)},${sql(p)},to_timestamp(${p.at}/1000.0)) ON CONFLICT(id) DO NOTHING;`,
  );
// Existing real accounts keep their handles if they collide with a demo identity.
lines.push("UPDATE public.demo_people d SET handle='demo_'||d.id, data=jsonb_set(d.data,'{handle}',to_jsonb('demo_'||d.id)) WHERE EXISTS(SELECT 1 FROM public.profiles p WHERE lower(p.handle)=lower(d.handle));");
writeFileSync("drizzle/migrations/0004_seed_catalog.sql", lines.join("\n") + "\n");
console.log(
  `Seeded SQL: ${NEARBY_STUDENTS.length} demo people, ${ALL_QUESTS.length} quests (${ALL_QUESTS.length - QUESTS.length} archived).`,
);
