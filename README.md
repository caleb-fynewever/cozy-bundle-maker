# Welcome to your Lovable project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

### AI quest writing

“Punch it up with AI” uses Anthropic’s Messages API. Copy `.env.example` to `.env` and add your key as `ANTHROPIC_API_KEY`; keep it server-side and never add a `VITE_` prefix. Set the same secret in the deployment environment to enable AI quest writing after deploy.

### Student email verification

Email codes are sent through [Resend](https://resend.com). Add `RESEND_API_KEY`, `EMAIL_FROM`, and `EMAIL_VERIFICATION_SECRET` to `.env` for local development and to your deployment's server environment after deploy. `EMAIL_FROM` must use a sender on a domain verified with Resend. Generate `EMAIL_VERIFICATION_SECRET` as a random secret with at least 32 characters. Restart the dev server after changing `.env`.

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS

### Combined development

The `deploy` branch combines the backend and multi-squad features from `cf/dev` with the interface and map from `overhaul`. See [the integration notes](docs/branch-integration.md) for feature ownership, validation, and rollout details.

Use **Node 22.12 or newer**. Run `npm run typecheck`, `npm test`, and `npm run build` before deployment.

Account sign-in, shared profiles, and real squad invitations use the existing Lovable Cloud/Supabase connection. Squad emails use Lovable's managed email service (`LOVABLE_API_KEY`); the older optional student-verification flow uses Resend. Local server configuration is listed in `.env.example`. Seed quests require no external API, but signed-in backend features require the configured connection.
