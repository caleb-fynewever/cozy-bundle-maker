import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

type BackFallback = "/" | "/feed" | "/leaderboard" | "/profile";

export function BackButton({ fallback, label = "Back", className = "" }: {
  fallback: BackFallback;
  label?: string;
  className?: string;
}) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) window.history.back();
        else void navigate({ to: fallback });
      }}
      className={`inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground ${className}`}
    >
      <ArrowLeft aria-hidden className="h-4 w-4" /> {label}
    </button>
  );
}
