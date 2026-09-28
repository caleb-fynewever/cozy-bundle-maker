import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Sign in — wego" },
      { name: "description", content: "Sign in to wego with your Google account. One tap, no password." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/", replace: true });
  }, [loading, session, navigate]);

  async function onGoogle() {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (error) {
        toast.error("Couldn't start Google sign-in. Try again.");
        setBusy(false);
      }
      // On success the browser navigates to Google; it returns to the origin
      // with tokens in the URL, which restoreSessionFromUrl() picks up.
    } catch {
      toast.error("Couldn't start Google sign-in. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-5">
      <div className="w-full max-w-sm">
        <p className="font-hand text-4xl leading-none">wego</p>
        <h1 className="mt-6 text-2xl font-semibold text-foreground">Sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          One tap with your Google account. No password, no codes.
        </p>

        <button
          type="button"
          onClick={onGoogle}
          disabled={busy || loading}
          className="mt-6 flex min-h-12 w-full items-center justify-center gap-3 rounded-lg border border-input bg-card text-base font-semibold text-foreground transition-opacity disabled:opacity-60"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
            <path
              fill="#4285F4"
              d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.16.83-.67 1.53-1.44 2.02l2.92 2.26c1.7-1.57 2.68-3.89 2.68-6.62z"
            />
            <path
              fill="#34A853"
              d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26a5.4 5.4 0 0 1-4.04 1.1A5.44 5.44 0 0 1 3.06 11.18l-3 2.32A9 9 0 0 0 9 18z"
            />
            <path
              fill="#FBBC05"
              d="M3.06 11.18A5.44 5.44 0 0 1 2.78 9c0-.76.13-1.5.28-2.18l-3-2.32a9 9 0 0 0 0 8.02l3-1.34z"
            />
            <path
              fill="#EA4335"
              d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.55-2.55C13.34.75 11.35 0 9 0 5.48 0 2.44 2.02.06 4.5l3 2.32C3.7 5.04 6.14 3.58 9 3.58z"
            />
          </svg>
          {busy ? "Opening Google…" : "Sign in with Google"}
        </button>

        <p className="mt-8 font-hand text-lg text-muted-foreground">see you out there.</p>
      </div>
    </div>
  );
}
