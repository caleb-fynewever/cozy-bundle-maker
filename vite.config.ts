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
