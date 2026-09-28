// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { env as processEnv } from "node:process";
import { loadEnv } from "vite";

// Load local secrets for server handlers without exposing them through Vite's client env.
const mode = processEnv["NODE_ENV"] === "production" ? "production" : "development";
const localEnv = loadEnv(mode, process.cwd(), "");

for (const key of [
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "LOVABLE_API_KEY",
  "LOVABLE_SEND_URL",
  "ANTHROPIC_API_KEY",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "EMAIL_VERIFICATION_SECRET",
  "SUPABASE_SERVICE_ROLE_KEY",
]) {
  if (localEnv[key] && !processEnv[key]) processEnv[key] = localEnv[key];
}

// Browser and authenticated server functions use the same public connection settings.
// The platform injects stale VITE_SUPABASE_* / SUPABASE_* values from a previously
// connected backend into the dev-server process env, and those win over .env in
// Vite's env loading — so the current project's settings are pinned here.
// These are publishable identifiers, never a service-role key or other server secret.
const SUPABASE_CONNECTION = {
  url: "https://evamtnygvhnyzewmeowe.supabase.co",
  publishableKey: "sb_publishable_RWN9ky3t__efGaj0JsE2SQ_-yfijqAL",
  projectId: "evamtnygvhnyzewmeowe",
} as const;

processEnv["SUPABASE_URL"] = SUPABASE_CONNECTION.url;
processEnv["VITE_SUPABASE_URL"] = SUPABASE_CONNECTION.url;
processEnv["SUPABASE_PUBLISHABLE_KEY"] = SUPABASE_CONNECTION.publishableKey;
processEnv["VITE_SUPABASE_PUBLISHABLE_KEY"] = SUPABASE_CONNECTION.publishableKey;
processEnv["SUPABASE_PROJECT_ID"] = SUPABASE_CONNECTION.projectId;
processEnv["VITE_SUPABASE_PROJECT_ID"] = SUPABASE_CONNECTION.projectId;

export default defineConfig({
  vite: {
    // The platform injects stale VITE_SUPABASE_* values from a previously
    // connected backend into the dev-server process env, and those win over
    // .env. Force the current project's publishable connection settings here.
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(processEnv["VITE_SUPABASE_URL"]),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(processEnv["VITE_SUPABASE_PUBLISHABLE_KEY"]),
      "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(processEnv["VITE_SUPABASE_PROJECT_ID"]),
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
