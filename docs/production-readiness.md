# Production readiness — September 27, 2026

Status: **not ready to republish against the new Supabase project**.

## Verified

- TypeScript passes and production build succeeds, including the sign-in compatibility fix.
- All 16 regression tests pass.
- Isolated PostgreSQL suite passes migrations, privacy/RLS, invitations, membership, account revisions, XP idempotency, verification rate limits, and deletion behavior.
- New Supabase project has all five migrations, 17 demo people, 76 quests (70 active, six archived), and one demo squad. All public tables have RLS enabled.
- Live database transaction passes profile and squad creation, invite acceptance, shared membership, account isolation, account save, directory/feed RPCs, and catalog reads. The transaction was rolled back; no test accounts remain.
- Public API cannot read protected quest rows anonymously; administrative and authenticated database reads work.
- Local browser build references the new project. No configured service key or database connection string was found in browser output.
- npm audit --omit=dev reports zero vulnerabilities at audit time.
- Both public domains respond HTTP 200. Their JavaScript still references the original Lovable database, not the new project.

## Lint result

Repository-wide lint fails: 2,005 errors and 17 warnings, with 1,998 errors marked automatically fixable. This is primarily a formatting backlog; it has not been bulk-rewritten during this audit. The lint gate is not green.

## Release blockers

1. Configure the Lovable deployment secrets `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` for the new owned project. `vite.config.ts` now falls back to the verified new project's public URL/key so browser builds without Vite aliases no longer target the legacy project. The server still requires `SUPABASE_URL` and the server-only service key; local `.env` does not configure Lovable.
2. Account migration completed from the September 27 export: 10 accounts, 10 identities, 7 profiles, 4 squads, 5 memberships, and 6 invitations. Reconcile changes made in the old database after this snapshot before switching.
3. Configure and verify new-project authentication email delivery and code templates. Lovable's displayed signup template currently shows a confirmation link. The app requires a code. Verify signup, returning-user sign-in, expiry, and sign-out on the deployed backend.
4. Configure RESEND_API_KEY, EMAIL_FROM, and EMAIL_VERIFICATION_SECRET (at least 32 characters) for student verification. They are absent locally and absent from Lovable's displayed project secret list. Set the service key only on the server.
5. Verify squad invite email delivery in the final runtime. Lovable has its managed LOVABLE_API_KEY and branded email UI, but no email was sent during this audit.
6. Complete a two-account browser test on the configured release preview: invite/accept, member-started activity, shared quest publication, cross-device state/XP, feed interactions, and privacy. SQL checks do not replace browser authentication and delivery testing.

## Code correction

Sign-in accepts numeric codes of 6–10 digits, matching Supabase's supported configuration range; previously it rejected every code that was not eight digits. Supabase remains responsible for verifying the actual code.

## Limits

No merge, publish, test email send, or production configuration change was performed. Account transfer was completed in a subsequent migration, described below. The build emits a bundle-size warning. Full end-to-end production behavior remains unverified until the release blockers above are resolved.

## Account transfer verification

The official Lovable export was downloaded and selected account/application rows were imported into the existing new schema. Original UUIDs, password hashes, metadata, confirmation states (including two unconfirmed accounts), profiles, squads, memberships, and invitations were preserved. Auth metadata was decoded to JSON objects and all exported fields were compared against PostgreSQL-normalized source values after import.

Supabase Auth admin API returns HTTP 200 and recognizes all 10 original IDs. No orphaned profiles or memberships were found. All 76 quests and 17 demo profiles remain; the squad creation trigger is enabled. Existing sessions and refresh tokens were not transferred; users must sign in again after cutover. Email delivery/sign-in remains a separate release check.

The source Cloud instance stays active and unchanged apart from the private export backup. The sensitive backup remains outside Git. Data saved only in users' browsers was not in the database export; the app's existing local-state sync handles it when those users sign in. Any account or squad changes after the export need reconciliation before cutover.
