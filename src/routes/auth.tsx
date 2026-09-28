import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { markInstallHintPending } from "@/components/InstallHint";
import { LANGUAGE_OPTIONS, type Locale } from "@/lib/i18n";
import { actions, useUserState } from "@/lib/store";

export const Route = createFileRoute("/auth")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Sign in | wego" },
      { name: "description", content: "Sign in to wego with your username and password." },
      { property: "og:title", content: "Sign in | wego" },
      { property: "og:description", content: "Sign in to wego with your username and password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

/** Auth needs an email under the hood; derive a stable synthetic one from the username. */
function toAuthEmail(username: string): string {
  const clean = username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
  return `${clean}@wego.local`;
}

function isValidUsername(username: string): boolean {
  return /^[a-z0-9._-]{3,20}$/.test(username.trim().toLowerCase());
}

function AuthPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const state = useUserState();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/", replace: true });
  }, [loading, session, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = username.trim().toLowerCase();
    if (!isValidUsername(name)) {
      toast.error("Username must be 3–20 characters: letters, numbers, dots, dashes, underscores.");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    setBusy(true);
    try {
      const email = toAuthEmail(name);
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { username: name } },
        });
        if (error) {
          toast.error(
            error.message.toLowerCase().includes("already")
              ? "That username is taken. Try signing in instead."
              : "Couldn't create your account. Try again.",
          );
          return;
        }
        if (!data.session) {
          // Email confirmation is enabled on the project — tell the user how to fix.
          toast.error("Account created, but sign-in is blocked. Email confirmation needs to be off.");
          return;
        }
        markInstallHintPending();
        toast.success("Account created. Welcome to wego!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          toast.error("Wrong username or password.");
          return;
        }
      }
      // Session is set; the effect above navigates to the app (or setup).
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-5">
      <div className="w-full max-w-sm">
        <div className="flex items-start justify-between gap-3">
          <p className="font-hand text-4xl leading-none">wego</p>
          <select
            value={state.language}
            onChange={(event) => actions.setLanguage(event.target.value as Locale)}
            aria-label="App language"
            className="-mr-1 shrink-0 rounded-md border border-input bg-card px-2 py-1.5 text-sm text-foreground"
          >
            {LANGUAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <h1 className="mt-6 text-2xl font-semibold text-foreground">
          {mode === "signin" ? "Sign in" : "Create your account"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "signin"
            ? "Pick up where you left off."
            : "Just a username and a password. That's it."}
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="username"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            maxLength={20}
            className="min-h-12 w-full rounded-lg border border-input bg-card px-4 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              maxLength={72}
              className="min-h-12 w-full rounded-lg border border-input bg-card pl-4 pr-16 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              {showPassword ? "hide" : "show"}
            </button>
          </div>
          <button
            type="submit"
            disabled={busy || loading}
            className="min-h-12 w-full rounded-lg bg-primary text-base font-semibold text-primary-foreground transition-opacity disabled:opacity-60"
          >
            {busy ? "One sec…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-4 w-full text-center text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
        >
          {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>

        <p className="mt-8 font-hand text-lg text-muted-foreground">see you out there.</p>
      </div>
    </div>
  );
}
