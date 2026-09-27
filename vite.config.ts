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

// Keep the browser auth client usable when the deployment builder omits the
// managed VITE_* aliases. These values are public connection identifiers, not
// privileged credentials.
processEnv["VITE_SUPABASE_URL"] ??= "https://lhsjyrqhujftuawwshav.supabase.co";
processEnv["VITE_SUPABASE_PUBLISHABLE_KEY"] ??=
  "sb_publishable_CnQHNZirCr8CkFC44irEzg_iMPYLO1F";

for (const key of [
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "LOVABLE_API_KEY",
  "LOVABLE_SEND_URL",
  "ANTHROPIC_API_KEY",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "EMAIL_VERIFICATION_SECRET",
]) {
  if (localEnv[key] && !processEnv[key]) processEnv[key] = localEnv[key];
}

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
