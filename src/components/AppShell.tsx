import { Link } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Compass, Map, Users, PlusCircle, User } from "lucide-react";
import { hydrate } from "@/lib/store";

const NAV = [
  { to: "/", label: "Discover", icon: Compass },
  { to: "/map", label: "Map", icon: Map },
  { to: "/create", label: "Create", icon: PlusCircle },
  { to: "/squad", label: "Squad", icon: Users },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  useEffect(() => {
    hydrate();
  }, []);

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-0">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2" aria-label="Side Quest home">
            <span className="grid h-8 w-8 place-items-center rounded-xl acid-fill font-display text-sm font-bold text-primary-foreground">
              SQ
            </span>
            <span className="font-display text-lg font-bold tracking-tight">Side Quest</span>
          </Link>
          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {NAV.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact: to === "/" }}
                activeProps={{ className: "bg-surface text-foreground" }}
                className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>

      <nav
        aria-label="Main"
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur md:hidden"
      >
        <ul className="mx-auto flex max-w-lg items-stretch justify-between px-2 pb-[env(safe-area-inset-bottom)]">
          {NAV.map(({ to, label, icon: Icon }) => (
            <li key={to} className="flex-1">
              <Link
                to={to}
                activeOptions={{ exact: to === "/" }}
                activeProps={{ className: "text-primary" }}
                className="flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground"
              >
                <Icon aria-hidden className="h-5 w-5" />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
