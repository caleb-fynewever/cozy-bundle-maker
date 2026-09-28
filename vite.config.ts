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
// Accept either naming convention locally; Lovable supplies the server names in production.
// These are publishable identifiers, never a service-role key or other server secret.
for (const [serverKey, browserKey, fallback] of [
  ["SUPABASE_URL", "VITE_SUPABASE_URL", "https://evamtnygvhnyzewmeowe.supabase.co"],
  ["SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_RWN9ky3t__efGaj0JsE2SQ_-yfijqAL"],
] as const) {
  const value = processEnv[serverKey] || processEnv[browserKey] || localEnv[serverKey] || localEnv[browserKey] || fallback;
  processEnv[serverKey] = value;
  processEnv[browserKey] = value;
}

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
