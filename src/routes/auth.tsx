import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { sendEmailCode, useAuth, verifyEmailCode } from "@/lib/auth";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Sign in — wego" },
      { name: "description", content: "Sign in to wego with your email. No password, just a code." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/", replace: true });
  }, [loading, session, navigate]);

  async function onSendCode(event: FormEvent) {
    event.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes("@")) {
      toast.error("That doesn't look like an email.");
      return;
    }
    setBusy(true);
    try {
      await sendEmailCode(trimmed);
      setEmail(trimmed);
      setStage("code");
      toast.success("Code sent — check your inbox.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't send the code. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onVerify(event: FormEvent) {
    event.preventDefault();
    const trimmed = code.trim();
    if (!/^\d{6,10}$/.test(trimmed)) {
      toast.error("Enter the full code from your email (6–10 digits).");
      return;
    }
    setBusy(true);
    try {
      await verifyEmailCode(email, trimmed);
      toast.success("You're in.");
      navigate({ to: "/", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That code didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error("Couldn't start Google sign-in. Try again.");
        setBusy(false);
        return;
      }
      // The browser is heading to Google (or the session is already set).
      if (!result.redirected) {
        navigate({ to: "/", replace: true });
      }
    } catch {
      toast.error("Couldn't start Google sign-in. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-5">
      <div className="w-full max-w-sm">
        <p className="font-hand text-4xl leading-none">wego</p>
        <h1 className="mt-6 text-2xl font-semibold text-foreground">
          {stage === "email" ? "Sign in with your email" : "Check your inbox"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {stage === "email"
            ? "No password. We email you a code, you type it in, you're set."
            : `We sent a sign-in code to ${email}. Enter the code from your email.`}
        </p>

        {stage === "email" ? (
          <form onSubmit={onSendCode} className="mt-6 space-y-3">
            <input
              type="email"
              required
              autoFocus
              autoComplete="email"
              placeholder="you@umn.edu"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="min-h-12 w-full rounded-lg border border-input bg-card px-4 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              disabled={busy}
              className="min-h-12 w-full rounded-lg bg-primary text-base font-semibold text-primary-foreground transition-opacity disabled:opacity-60"
            >
              {busy ? "Sending…" : "Email me a code"}
            </button>
          </form>
        ) : (
          <form onSubmit={onVerify} className="mt-6 space-y-3">
            <input
              type="text"
              required
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={10}
              placeholder="00000000"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              className="min-h-12 w-full rounded-lg border border-input bg-card px-4 text-center text-2xl font-semibold tracking-[0.5em] text-foreground placeholder:tracking-[0.5em] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              disabled={busy}
              className="min-h-12 w-full rounded-lg bg-primary text-base font-semibold text-primary-foreground transition-opacity disabled:opacity-60"
            >
              {busy ? "Checking…" : "Sign in"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStage("email");
                setCode("");
              }}
              className="w-full py-2 text-sm font-medium text-muted-foreground underline underline-offset-4"
            >
              Use a different email
            </button>
          </form>
        )}

        <div className="mt-6 flex items-center gap-3" aria-hidden>
          <span className="h-px flex-1 bg-border" />
          <span className="font-hand text-sm text-muted-foreground">or</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <button
          type="button"
          onClick={onGoogle}
          disabled={busy}
          className="mt-6 flex min-h-12 w-full items-center justify-center gap-3 rounded-lg border border-input bg-card text-base font-semibold text-foreground transition-opacity disabled:opacity-60"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
            <path
              fill="#4285F4"
              d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92a8.78 8.78 0 0 0 2.68-6.62Z"
            />
            <path
              fill="#34A853"
              d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26a5.55 5.55 0 0 1-4.04-1.1H4.08v2.34A9 9 0 0 0 9 18Z"
            />
            <path
              fill="#FBBC05"
              d="M3 11.18A5.4 5.4 0 0 1 2.72 9c0-.76.13-1.49.28-2.18V4.48H-.01a9 9 0 0 0 0 9.04L3 11.18Z"
            />
            <path
              fill="#EA4335"
              d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59A9 9 0 0 0-.01 4.48L3 6.82C3.68 5.02 6.14 3.58 9 3.58Z"
            />
          </svg>
          Sign in with Google
        </button>

        <p className="mt-8 font-hand text-lg text-muted-foreground">see you out there.</p>
      </div>
    </div>
  );
}
