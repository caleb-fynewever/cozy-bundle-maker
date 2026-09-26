import { Link } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Compass, Trophy, Users, User } from "lucide-react";
import { hydrate } from "@/lib/store";

const NAV = [
  { to: "/", label: "Discover", icon: Compass },
  { to: "/squad", label: "Squad", icon: Users },
  { to: "/leaderboard", label: "Ranks", icon: Trophy },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function AppShell({ children, wide = false, compact = false }: { children: ReactNode; wide?: boolean; compact?: boolean }) {
  useEffect(() => {
    hydrate();
  }, []);

  return (
    <div className={`min-h-screen bg-background ${compact ? "overflow-x-clip pb-16" : "pb-24"} md:pb-0`}>
       <header className="sticky top-0 z-50 border-b border-border bg-background/95">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 md:h-[72px] md:px-8">
         <Link to="/" className="font-hand text-[28px] leading-none md:text-[34px]" aria-label="wego home">
           wego
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-8 md:flex">
          {NAV.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === "/" }}
               activeProps={{ className: "text-foreground underline decoration-2 decoration-primary underline-offset-8" }}
                className="py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {label}
            </Link>
          ))}
        </nav>
        </div>
      </header>

      <main className={`mx-auto px-5 pt-5 md:px-8 md:pt-10 ${compact ? "pb-0 md:pb-16" : "pb-16"} ${wide ? "max-w-7xl" : "max-w-5xl"}`}>{children}</main>

      <nav
        aria-label="Main"
         className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card text-foreground md:hidden"
      >
        <ul className="mx-auto flex max-w-lg items-stretch justify-between px-2 pb-[env(safe-area-inset-bottom)]">
          {NAV.map(({ to, label, icon: Icon }) => (
            <li key={to} className="flex-1">
              <Link
                to={to}
                activeOptions={{ exact: to === "/" }}
                  activeProps={{ className: "text-foreground bg-primary" }}
                  className="flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground"
              >
                <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
