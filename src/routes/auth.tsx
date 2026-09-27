import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { sendEmailCode, useAuth, verifyEmailCode } from "@/lib/auth";

export const Route = createFileRoute("/auth")({
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
    if (trimmed.length !== 6) {
      toast.error("The code is 6 digits.");
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
            : `We sent a 6-digit code to ${email}. It expires in a few minutes.`}
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
              maxLength={6}
              placeholder="123456"
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

        <p className="mt-8 font-hand text-lg text-muted-foreground">see you out there.</p>
      </div>
    </div>
  );
}
