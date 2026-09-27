import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Bell, Compass, Footprints, Newspaper, Trophy, Users, User } from "lucide-react";
import { actions, hydrate, useUserState } from "@/lib/store";
import { Button } from "@/components/ui-kit";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getQuest } from "@/data/quests";

const NAV = [
  { to: "/feed", label: "Feed", icon: Newspaper },
  { to: "/", label: "Quests", icon: Compass },
  { to: "/squad", label: "Squad", icon: Users },
  { to: "/leaderboard", label: "Ranks", icon: Trophy },
  { to: "/profile", label: "Profile", icon: User },
] as const;
export function AppShell({ children, wide = false, compact = false }: { children: ReactNode; wide?: boolean; compact?: boolean }) {
  const state = useUserState();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(true);
  const lastScrollY = useRef(0);
  const scrollDelta = useRef(0);
  const lastDirection = useRef(0);
  const headerRef = useRef<HTMLElement>(null);
  const activeQuestId = state.inProgress.at(-1);
  const activeQuest = activeQuestId
    ? state.createdQuests.find((quest) => quest.id === activeQuestId) ?? getQuest(activeQuestId)
    : undefined;
  const pathname = useRouterState({ select: (routerState) => routerState.location.pathname });
  const mobileNavCount = NAV.length + (activeQuest ? 1 : 0);
  const activeMobileNavIndex = pathname.startsWith("/go/") && activeQuest
    ? NAV.length
    : pathname === "/feed" ? 0
      : pathname === "/squad" ? 2
        : pathname === "/leaderboard" ? 3
          : pathname === "/profile" ? 4
            : 1;
  useEffect(() => {
    hydrate();
  }, []);

  useEffect(() => {
    const mobileViewport = window.matchMedia("(max-width: 767px)");
    const resetScrollTracking = () => {
      lastScrollY.current = window.scrollY;
      scrollDelta.current = 0;
      lastDirection.current = 0;
      if (!mobileViewport.matches || notificationsOpen) setHeaderVisible(true);
    };
    resetScrollTracking();

    const handleScroll = () => {
      const currentY = window.scrollY;
      const delta = currentY - lastScrollY.current;
      lastScrollY.current = currentY;

      if (!mobileViewport.matches || notificationsOpen || headerRef.current?.contains(document.activeElement)) {
        setHeaderVisible(true);
        scrollDelta.current = 0;
        lastDirection.current = 0;
        return;
      }
      if (currentY < 24) {
        setHeaderVisible(true);
        scrollDelta.current = 0;
        lastDirection.current = 0;
        return;
      }
      if (!delta) return;

      const direction = Math.sign(delta);
      if (direction !== lastDirection.current) scrollDelta.current = 0;
      lastDirection.current = direction;
      scrollDelta.current += delta;

      // Ignore tiny touch jitter. Reveal quickly when the user intentionally reverses direction.
      if (direction > 0 && currentY > 120 && scrollDelta.current >= 18) {
        setHeaderVisible(false);
        scrollDelta.current = 0;
      } else if (direction < 0 && scrollDelta.current <= -12) {
        setHeaderVisible(true);
        scrollDelta.current = 0;
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    mobileViewport.addEventListener("change", resetScrollTracking);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      mobileViewport.removeEventListener("change", resetScrollTracking);
    };
  }, [notificationsOpen]);

  return (
    <div className={`min-h-screen bg-background ${compact ? "overflow-x-clip pb-24" : "pb-24"} md:pb-0`}>
       <header
        ref={headerRef}
        onFocusCapture={() => setHeaderVisible(true)}
        className={`sticky top-0 z-50 border-b border-border bg-background/95 ease-out motion-safe:transition-transform motion-safe:duration-300 motion-reduce:transition-none md:translate-y-0 md:pointer-events-auto ${headerVisible ? "translate-y-0" : "-translate-y-full pointer-events-none"}`}
       >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 md:h-[72px] md:px-8">
         <Link to="/" className="font-hand text-[28px] leading-none md:text-[34px]" aria-label="wego home">
           wego
        </Link>
        <div className="flex items-center gap-6">
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
          {activeQuest ? (
            <Link
              to="/go/$questId"
              params={{ questId: activeQuest.id }}
              activeProps={{ className: "text-foreground underline decoration-2 decoration-primary underline-offset-8" }}
              className="inline-flex items-center gap-1.5 py-2 text-sm font-semibold text-primary transition-colors hover:text-foreground"
            >
              <Footprints aria-hidden className="h-4 w-4" /> Active quest
            </Link>
          ) : null}
        </nav>
        <Dialog open={notificationsOpen} onOpenChange={setNotificationsOpen}>
          <button type="button" onClick={() => setNotificationsOpen(true)} aria-label={`Squad invites${state.squadInvites.length ? `, ${state.squadInvites.length} pending` : ""}`} className="relative grid h-10 w-10 place-items-center rounded-full border border-border hover:bg-surface">
            <Bell aria-hidden className="h-5 w-5" />
            {state.squadInvites.length ? <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">{state.squadInvites.length}</span> : null}
          </button>
          <DialogContent>
            <DialogHeader><DialogTitle>Squad invites</DialogTitle><DialogDescription>Invites and updates for your squad.</DialogDescription></DialogHeader>
            {state.squadInvites.length ? <ul className="divide-y divide-border">{state.squadInvites.map((invite) => <li key={invite.id} className="flex items-center gap-3 py-3"><div className="min-w-0 flex-1"><p className="font-medium">{invite.direction === "received" ? `${invite.personName} invited you` : `Invite sent to ${invite.personName}`}</p><p className="text-sm text-muted-foreground">{invite.direction === "received" ? `Join ${invite.squadName ?? "their squad"}?` : `For ${invite.squadName ?? "your squad"} · waiting for a response`}</p></div>{invite.direction === "received" ? <><Button onClick={() => actions.acceptSquadInvite(invite.id)}>Accept</Button><Button variant="ghost" onClick={() => actions.dismissSquadInvite(invite.id)}>Decline</Button></> : <Button variant="ghost" onClick={() => actions.dismissSquadInvite(invite.id)}>Dismiss</Button>}</li>)}</ul> : <p className="py-4 text-sm text-muted-foreground">You’re all caught up. Squad invites will show up here.</p>}
          </DialogContent>
        </Dialog>
        </div>
        </div>
      </header>

      <main className={`mx-auto px-5 pt-5 md:px-8 md:pt-10 ${compact ? "pb-0 md:pb-16" : "pb-16"} ${wide ? "max-w-7xl" : "max-w-5xl"}`}>{children}</main>

      <nav
        aria-label="Main"
        className="mobile-nav-float fixed bottom-3 left-1/2 z-40 w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 rounded-full border border-border p-1 text-foreground backdrop-blur-xl md:hidden"
      >
        <ul
          className="mobile-nav-list relative z-[1] mx-auto grid h-12 items-stretch"
          style={{
            "--nav-item-width": `${90 / mobileNavCount}%`,
            "--nav-active-left": `${(activeMobileNavIndex * 100 + 5) / mobileNavCount}%`,
            gridTemplateColumns: `repeat(${mobileNavCount}, minmax(0, 1fr))`,
          } as CSSProperties}
        >
          <span className="mobile-nav-indicator" aria-hidden="true" />
          {NAV.map(({ to, label, icon: Icon }) => (
            <li key={to} className="min-w-0 flex-1">
              <Link
                to={to}
                activeOptions={{ exact: to === "/" }}
                activeProps={{ className: "text-primary" }}
                aria-label={label}
                title={label}
                className="mobile-nav-link flex min-h-12 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <Icon aria-hidden className="h-[22px] w-[22px]" strokeWidth={1.9} />
                <span className="sr-only">{label}</span>
              </Link>
            </li>
          ))}
          {activeQuest ? (
            <li className="min-w-0 flex-1">
              <Link
                to="/go/$questId"
                params={{ questId: activeQuest.id }}
                activeProps={{ className: "text-primary" }}
                aria-label={`Active quest: ${activeQuest.title}`}
                title="Active quest"
                className="mobile-nav-link flex min-h-12 items-center justify-center rounded-full text-primary transition-colors hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <Footprints aria-hidden className="h-[22px] w-[22px]" strokeWidth={1.9} />
                <span className="sr-only">Active quest</span>
              </Link>
            </li>
          ) : null}
        </ul>
      </nav>
    </div>
  );
}
