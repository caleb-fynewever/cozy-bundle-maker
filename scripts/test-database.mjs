const { PGlite } = await import(process.env.WEGO_PGLITE_MODULE || "@electric-sql/pglite");
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const db = new PGlite();
await db.exec(
  `CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$; GRANT USAGE ON SCHEMA auth,public TO authenticated; GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO authenticated;`,
);
for (const f of [
  "0000_squad_invites",
  "0001_create_profiles",
  "0002_shared_squads",
  "0003_app_database",
  "0004_seed_catalog",
])
  await db.exec(readFileSync(`${process.cwd()}/drizzle/migrations/${f}.sql`, "utf8"));
console.log("All migrations applied");
const a = "00000000-0000-4000-8000-000000000001",
  b = "00000000-0000-4000-8000-000000000002";
await db.exec(
  `INSERT INTO auth.users VALUES ('${a}'),('${b}'); INSERT INTO profiles(id,handle,name,email) VALUES ('${a}','test_a','A','a@example.com'),('${b}','test_b','B','b@example.com');`,
);
async function as(id) {
  await db.exec(
    `RESET ROLE; SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${id}',false);`,
  );
}
await as(a);
assert.equal((await db.query("SELECT * FROM demo_people")).rows.length, 17);
assert.equal((await db.query("SELECT * FROM quests")).rows.length, 76);
await assert.rejects(db.query("SELECT email FROM profiles"));
const squad = (
  await db.query("INSERT INTO squads(name,leader_id) VALUES ('Test',auth.uid()) RETURNING id")
).rows[0].id;
await db.query(`INSERT INTO squad_demo_members VALUES ('${squad}','u_alex')`);
await assert.rejects(
  db.query(`DELETE FROM squad_members WHERE squad_id='${squad}' AND user_id=auth.uid()`),
);
const payload = JSON.stringify({ completed: ["q_snack_crawl"], publicProfile: true });
assert.equal(
  (await db.query("SELECT save_account_state(0,$1::jsonb) AS revision", [payload])).rows[0]
    .revision,
  1,
);
await assert.rejects(db.query("SELECT save_account_state(0,$1::jsonb)", [payload]));
assert.equal((await db.query("SELECT * FROM people_directory() WHERE id=$1", [a])).rows[0].xp, 160);
await as(b);
assert.equal((await db.query("SELECT * FROM account_state")).rows.length, 0);
assert.equal((await db.query("SELECT * FROM squads")).rows.length, 0);
await assert.rejects(db.query(`INSERT INTO squad_demo_members VALUES ('${squad}','u_maya')`));
await assert.rejects(
  db.query("INSERT INTO quests(id,owner_id,content) VALUES ('bad',auth.uid(),'{}')"),
);
await as(a);
// A handle invitation is readable and acceptable by its recipient without exposing email.
const invite = (
  await db.query(
    `INSERT INTO squad_invites(squad_key,squad_name,inviter_id,inviter_name,invitee_email,invitee_id) VALUES ('${squad}','Test','${a}','A','@test_b','${b}') RETURNING id`,
  )
).rows[0].id;
await as(b);
await assert.rejects(
  db.query(`UPDATE squad_invites SET inviter_id='${b}',status='accepted' WHERE id='${invite}'`),
);
await db.query(`UPDATE squad_invites SET status='accepted',invitee_id='${b}' WHERE id='${invite}'`);
assert.equal((await db.query("SELECT * FROM squads")).rows.length, 1);
await as(a);
// Completion retries are idempotent; undo only deactivates the completion award.
await db.query("SELECT save_account_state(1,$1::jsonb)", [payload]);
const before = (await db.query("SELECT * FROM people_directory() WHERE id=$1", [a])).rows[0].xp;
await db.query("SELECT save_account_state(2,$1::jsonb)", [payload]);
assert.equal(
  (await db.query("SELECT * FROM people_directory() WHERE id=$1", [a])).rows[0].xp,
  before,
);
await db.query("SELECT save_account_state(3,$1::jsonb)", [
  JSON.stringify({ completed: [], publicProfile: false }),
]);
assert.equal(
  (await db.query("SELECT * FROM people_directory() WHERE id=$1", [a])).rows[0].xp,
  before - 120,
);
// Shared feed is visible to squadmates, private after leaving; retries do not duplicate hearts/comments.
const post = {
  id: "p_test_a",
  questId: "q_snack_crawl",
  rating: 9,
  ratingCount: 1,
  caption: "Test post",
  photo: null,
  withNames: [],
};
await db.query(`SELECT sync_social($1::jsonb,'[]','{}')`, [JSON.stringify([post])]);
await as(b);
assert(
  (await db.query("SELECT read_feed() AS feed")).rows[0].feed.some((p) => p.id === "p_test_a"),
);
const comments = JSON.stringify({ p_test_a: [{ id: "comment_b", text: "Nice quest" }] });
await db.query(`SELECT sync_social('[]',$1::jsonb,$2::jsonb)`, [
  JSON.stringify(["p_test_a"]),
  comments,
]);
await db.query(`SELECT sync_social('[]',$1::jsonb,$2::jsonb)`, [
  JSON.stringify(["p_test_a"]),
  comments,
]);
assert.equal((await db.query("SELECT * FROM post_hearts WHERE post_id='p_test_a'")).rows.length, 1);
assert.equal(
  (await db.query("SELECT * FROM post_comments WHERE post_id='p_test_a'")).rows.length,
  1,
);
await as(a);
// Verification is service-only and awards exactly once.
await assert.rejects(
  db.query(`INSERT INTO student_verifications(user_id,email) VALUES ('${a}','a@school.edu')`),
);
await db.exec("RESET ROLE; SET ROLE service_role");
await db.query(`INSERT INTO student_verifications(user_id,email) VALUES ('${a}','a@school.edu')`);
for (let i = 0; i < 5; i++)
  assert.equal(
    (await db.query("SELECT take_verification_attempt($1,false) AS ok", [a])).rows[0].ok,
    true,
  );
assert.equal(
  (await db.query("SELECT take_verification_attempt($1,false) AS ok", [a])).rows[0].ok,
  false,
);
await as(a);
assert.equal((await db.query("SELECT * FROM student_verifications")).rows.length, 1);
const sample = (await db.query("SELECT content FROM quests WHERE id='q_snack_crawl'")).rows[0]
  .content;
const ownQuest = { ...sample, id: "q_user_test", createdBy: a };
await db.query("SELECT publish_quest($1::jsonb)", [JSON.stringify(ownQuest)]);
await db.query("SELECT publish_quest($1::jsonb)", [JSON.stringify(ownQuest)]);
assert.equal(
  (await db.query("SELECT * FROM xp_events WHERE kind='create' AND ref_id='q_user_test'")).rows
    .length,
  1,
);
await as(b);
await assert.rejects(db.query("SELECT publish_quest($1::jsonb)", [JSON.stringify(ownQuest)]));
await as(a);
await assert.rejects(
  db.query("SELECT publish_quest($1::jsonb)", [
    JSON.stringify({ ...ownQuest, id: "q_invalid", title: "   " }),
  ]),
);
await db.query(`DELETE FROM squads WHERE id='${squad}'`);
await as(b);
assert(
  !(await db.query("SELECT read_feed() AS feed")).rows[0].feed.some((p) => p.id === "p_test_a"),
);
assert.equal((await db.query("SELECT * FROM student_verifications")).rows.length, 0);
assert.equal((await db.query("SELECT * FROM people_directory() WHERE id=$1", [a])).rows.length, 0);
await db.exec("RESET ROLE; SET ROLE anon");
await assert.rejects(db.query("SELECT * FROM account_state"));
await assert.rejects(db.query("SELECT save_account_state(0,$1::jsonb)", [payload]));

console.log(
  "Passed: RLS, privacy, invitations, demo membership, revisions, XP retries/undo, verification limits, anonymous denial, deletion.",
);
await db.close();
