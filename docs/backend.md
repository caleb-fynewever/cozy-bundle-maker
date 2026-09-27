# wego database

## Deployment status

All five migrations have been applied to the new user-owned Supabase project and basic live database workflows verified. The original Lovable database has **not** been migrated, and existing accounts and linked rows have been copied from the September 27 export. Publishing the frontend alone does not change deployment credentials. See [production readiness](production-readiness.md) for verified checks and release blockers.

The existing Supabase project and auth accounts are retained. Existing migrations `0000`–`0002` must already be applied. New migrations are `0003_app_database.sql` and `0004_seed_catalog.sql`; their order is registered in the Drizzle migration journal.

## Apply through Lovable

Open the connected project and ensure it has the backend branch's code. Ask Lovable:

> Apply the existing migrations drizzle/migrations/0003_app_database.sql and drizzle/migrations/0004_seed_catalog.sql, in order, to this project's Cloud database. Preserve existing auth users, profiles, squads, and invitations. Register both migrations in migration history and regenerate the Supabase types. Do not generate replacement tables or rerun the older migrations. Verify the policies, RPC permissions, and seed counts before publishing.

Alternatively, the Cloud SQL editor can execute `docs/install-backend.sql` as one transaction. It is a **one-time installer**, not an idempotent script. Have Lovable record those two migrations as applied afterward so its migration runner does not attempt them again.

Expected seed counts: 17 demo profiles, 76 quests, 70 active quests, six archived quests, one founders demo squad, and the existing demo feed posts. Demo people have no auth accounts or passwords.

After SQL is applied, publish the app and use two ordinary accounts to verify:

1. Create a squad, invite the second account, and accept. Both see the same membership.
2. Add a demo member as leader; refresh the second account. Remove the member and confirm it stays removed.
3. Publish a quest on account A; find it from account B in Discover or the map.
4. Save and complete a quest; sign into another device and check saved/completed state and XP.
5. Share a post, heart it, and comment as a squadmate. Leave the squad and confirm its private posts disappear.
6. Turn off public profile visibility and confirm unrelated accounts cannot read it.

## Tables and access

- `profiles`: existing real auth identities. Public fields are readable for public profiles and squadmates; email is not exposed to authenticated clients.
- `demo_people`, `demo_squads`, `demo_squad_members`: administrator-seeded demo catalog, readable by signed-in users.
- `squads`, `squad_members`: shared real squads with owner checks and invitation-based membership.
- `squad_demo_members`: demo people added to real squads, editable by the leader only.
- `quests`: shared catalog, owner-bound publication, validated content, archival instead of deleting historical links.
- `account_state`: private, versioned saves, schedules, passes, completions, preferences, and reaction drafts. Stale writes receive a conflict and are merged before retrying.
- `quest_completions`, `xp_events`: database-derived progress and idempotent awards. Browser-supplied XP totals never determine public rank.
- `student_verifications`, `verification_limits`: private confirmed student emails, request/attempt limits, and one verification award per account.
- `feed_posts`, `post_hearts`, `post_comments`: shared social activity. Real posts are readable by the author and current squadmates; demo posts are seeded content.

State remains cached in `store.ts`. Sync runs after edits, on focus/reconnect, and every 30 seconds. Pending activity survives a refresh through the account's localStorage cache. Quest publication waits for database confirmation. Cross-account responses are ignored and sync writes verify the initiating account ID.

The app imports existing locally created quests, completions, posts, and demo memberships. It preserves retired quest IDs and hides them from Discover/map. Leaving a demo squad is synchronized. Server-confirmed XP replaces local estimates after synchronization. A legacy student badge that only exists on the device must be verified again because it has no server proof.

## Configuration

Existing public Supabase URL/key aliases remain unchanged. Server-side student verification needs `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, and `EMAIL_VERIFICATION_SECRET` (at least 32 characters) in Lovable Cloud secrets. The service key must never use a `VITE_` name or be placed in client code. Sign-in OTP and squad invitation email delivery retain their existing configuration.

The `AppDatabase` extension in `src/lib/database.types.ts` describes new SQL objects without editing the generated Supabase file. After Lovable regenerates types, it can be consolidated with the generated type safely.

## Verification

Use Node 22.12+ (Node 24 was used for validation):

```sh
npm run typecheck
npm test
npm run build
```

The isolated PostgreSQL suite uses PGlite without a live Supabase account:

```sh
npm install --prefix /tmp/wego-db-test --no-package-lock @electric-sql/pglite
WEGO_PGLITE_MODULE=/tmp/wego-db-test/node_modules/@electric-sql/pglite/dist/index.js npm run test:database
```

It checks schema/seed loading, account isolation, email privacy, private profiles, squad ownership, invitation acceptance/immutability, XP retries and undo, social visibility, repeated reactions, and verification limits. Auth schema helpers in this test simulate Supabase claims; live authentication and email delivery still need the deployment checks above.

`node scripts/build-database-install.mjs` rebuilds the one-time installer. Generate seed SQL only before the initial migration is applied; future catalog changes belong in new migrations, never edits to published migration history.

## Current operational bounds

The feed reads the latest 500 visible posts; profile/rank directory reads are limited to 1,000 people per refresh. Images use the existing inline format (up to 2 MB per feed photo). Moving images to object storage and adding cursor-based feed/directory pagination are required before scaling past those bounds. Recommendation scoring stays in `engine.ts`; approximate location remains device-only.
