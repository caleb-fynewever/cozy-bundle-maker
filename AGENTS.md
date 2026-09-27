<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Project rules

- Product is **wego**: a student social-discovery app. Core principle: don't recommend
  places, create reasons to go.
- All recommendation logic lives in `src/lib/engine.ts` (taste vectors, scoring, pipeline,
  compatibility, tonight trio). Weights are exported as `WEIGHTS` so behaviour is tuned in one
  place — never inline scoring rules in components.
- Quest and user seed data lives in `src/data/` as plain TypeScript so the app works with zero
  API keys or backend.
- User state (saved, completed, passed, rankings, squad, XP, privacy) lives in `src/lib/store.ts`,
  a localStorage-backed external store read through `useUserState()`. No global state in routes.
- Privacy rule: never render or store exact user coordinates; only approximate distance.
- Colors, gradients and shadows are semantic tokens in `src/styles.css`. No color utilities in
  components.
- Shared editorial styling belongs in semantic tokens and reusable UI components so every route stays visually consistent on phone and laptop.
- Use Figtree as the readable principal typeface and Schoolbell for the full wordmark and short human notes; this keeps controls clear and the voice casual.
- Keep Discover as a single-card swipe-only deck with real images and pass/save actions; this gives each quest one clear decision without a scrolling feed.
- Keep public Lovable Cloud browser connection identifiers as Vite fallbacks because the deployment builder may omit its managed aliases; they are publishable values, never privileged credentials.
- Use the same code-only auth email for signup, magic-link, and recovery events because passwordless sign-in may classify returning users as recovery.
