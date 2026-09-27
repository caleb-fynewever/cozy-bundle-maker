# Combined development branch

`deploy` integrates `cf/dev` at `4d3602d` and `overhaul` at `8816052` with a merge commit. The original branches and their published history are retained.

## Feature ownership

- **cf/dev:** Supabase authentication, code-only auth emails, account setup, shared profile lookup/sync, real email and handle invitations, invitation acceptance/revocation, multiple squads, ownership rules, scheduled end times, and account-specific local storage.
- **overhaul:** persistent app frame, glass navigation, single-card Discover deck, map and directions, lists, quest creation/presentation, feed, profile, progress/badge/leaderboard animations, and graphics.
- **Reconciled:** the new squad page combines overhaul's leaderboard and weekly progress with multi-squad management. Quest planning uses overhaul's presentation with multiple squad selection, real friends, ownership checks, and overnight end times in calendar exports.

## State compatibility

The existing `wego.state.v1` and account-specific storage keys remain in use. Single-squad overhaul saves become a named squad; existing cf/dev squads, owners, friends, schedules, and account identity survive. Progress animation markers and undo are supported without running overhaul's automatic demo identity/team seeding. Saving a quest does not grant XP, following cf/dev's existing rule and migration.

Six quests removed by overhaul are retained in `src/data/archived-quests.ts` for existing saves, completion history, and direct links. Discover and the map use only the active catalog, as requested.

## Integration fixes

- `@handle` invites follow the handle path instead of email validation.
- Invitation feedback distinguishes saved invitations from actual email delivery.
- Profile edits synchronize with the backend before updating local state.
- Real accepted friends appear in the quest crew picker.
- Selecting an existing joined squad also updates its active leader.
- Local squad actions enforce owner restrictions consistently.
- Approximate-location controls remain available in profile settings.

## Validation

Use Node 22.12 or newer (verification used Node 24).

```sh
npm install
npm run typecheck
npm test
npm run build
npm run lint
```

Nine focused tests pass, covering the archived catalog and both storage formats, account isolation, squad ownership, schedule/undo consistency, XP, and location rounding. Browser checks use an isolated test session with all Supabase and server-function requests blocked. They cover desktop and phone routes, Discover save/undo, squad creation, leader restrictions, overnight scheduling, calendar links, reload persistence, and profile controls. Additional checks cover archived saved/direct links, custom dates, map pin/save/directions interactions, and the WebGL-disabled map fallback. No page exceptions or horizontal overflow were observed at 390px and 1440px widths. They do not establish live email delivery or database behavior.

Production build, TypeScript, and lint on the manually reconciled files pass. Full-repository lint has inherited formatting errors from both branches and seven non-formatting errors in unchanged generated/email files. Those seven were checked against cf/dev and match its baseline. The integration does not disable lint rules to hide them.

## Existing backend boundaries

Auth, shared profiles, and invitations use Supabase. Most quest activity, XP, squad definitions/rosters, and privacy preferences still live in account-specific localStorage. This merge does not turn those into database-synchronized features. Leaderboards still use seed people and local activity; they do not fetch other real users' XP.

Live verification should cover two real accounts: sign in by code, edit/find a profile, invite by email and handle, accept/decline/revoke, then confirm the resulting rosters. Send test emails only to addresses approved for that check.

## Lovable rollout

Creating or pushing `deploy` does not switch the Lovable project's connected branch. Keep the current production connection until the combined version is reviewed. When approved, connect Lovable to `deploy`, retain the existing Supabase project and managed email configuration, and publish through Lovable. Existing database migrations are preserved; this integration does not require a new schema migration.
