import { findQuest } from "@/lib/catalog";
import { useDatabaseSync } from "@/lib/database-sync";
import { useSharedSquadSync } from "@/lib/shared-squads";
import { useSquadInvites } from "@/lib/squad-invites";
import { toast } from "sonner";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Bell,
  Compass,
  Footprints,
  Trophy,
  Map as MapIcon,
  Newspaper,
  Users,
} from "lucide-react";
import { actions, hydrate, useUserState } from "@/lib/store";
import { Avatar, Button } from "@/components/ui-kit";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { GlassTabBar, type GlassTab } from "@/components/GlassTabBar";
import { EASE_OUT, reducedMotion } from "@/lib/motion";

const NAV = [
  { to: "/feed", label: "Feed", icon: Newspaper },
  { to: "/", label: "Quests", icon: Compass },
  { to: "/squad", label: "Squad", icon: Users },
  { to: "/leaderboard", label: "Ranks", icon: Trophy },
  { to: "/map", label: "Map", icon: MapIcon },
] as const;

function activeIndexFor(pathname: string, activeQuestId: string | null) {
  if (pathname === "/") return 1;
  const index = NAV.findIndex((item) => item.to !== "/" && pathname.startsWith(item.to));
  if (index >= 0) return index;
  return activeQuestId && pathname === `/go/${activeQuestId}` ? NAV.length : -1;
}

/** True inside AppFrame, so a page's AppShell renders only its <main>. */
const Framed = createContext(false);

/*
 * The app's chrome (header, desktop nav, liquid-glass tab bar) lives in the root route, so it stays
 * mounted from page to page: the nav squiggle and the glass lens glide to the new page instead of
 * being rebuilt, and focus stays where it was. Pages describe their <main> with AppShell.
 */
export function AppFrame({ children }: { children: ReactNode }) {
  const state = useUserState();
  const remote = useSquadInvites();
  useSharedSquadSync();
  useDatabaseSync();
  const inviteCount = state.squadInvites.length + remote.received.length;
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const activeQuestId = state.inProgress.at(-1);
  const activeQuest = activeQuestId
    ? (findQuest(state, activeQuestId))
    : undefined;

  useEffect(() => {
    hydrate();
  }, []);

  // After a navigation, if the thing you pressed went away with the old page, start the new page
  // at its content instead of dropping keyboard and screen-reader users back at the top.
  useEffect(
    () =>
      router.subscribe("onResolved", (event) => {
        if (!event.pathChanged) return;
        requestAnimationFrame(() => {
          const lost = !document.activeElement || document.activeElement === document.body;
          if (lost) document.getElementById("main")?.focus({ preventScroll: true });
        });
      }),
    [router],
  );

  const tabs: GlassTab[] = [
    ...NAV.map((item) => ({ to: item.to, label: item.label, icon: item.icon })),
    ...(activeQuest
      ? [
          {
            to: "/go/$questId",
            params: { questId: activeQuest.id },
            label: `Active quest: ${activeQuest.title}`,
            icon: Footprints,
            dot: true,
          },
        ]
      : []),
  ];
  const active = activeIndexFor(pathname, activeQuest?.id ?? null);

  return (
    <Framed.Provider value>
      <div className="app-frame bg-background">
        <header className="sticky top-0 z-50 shrink-0 border-b border-border bg-background">
          <div className="safe-x mx-auto flex h-16 max-w-7xl items-center justify-between md:h-[72px]">
            <Link
              to="/"
              className="app-wordmark press font-hand text-[28px] leading-none md:text-[34px]"
              aria-label="wego home"
            >
              wego
            </Link>
            <div className="flex items-center gap-7">
              <DesktopNav
                pathname={pathname}
                activeQuest={activeQuest ? { id: activeQuest.id } : null}
              />
              <div className="flex items-center gap-2">
                <Dialog open={notificationsOpen} onOpenChange={setNotificationsOpen}>
                  <DialogTrigger asChild>
                    <button
                      type="button"
                      aria-label={`Squad invites${inviteCount ? `, ${inviteCount} pending` : ""}`}
                      className="press relative grid h-11 w-11 cursor-pointer place-items-center rounded-full border border-border hover:border-border-strong hover:bg-card"
                    >
                      <Bell aria-hidden className="h-5 w-5" strokeWidth={2} />
                      {inviteCount ? (
                        <span className="absolute -right-1 -top-1 grid h-[22px] min-w-[22px] place-items-center rounded-full border-2 border-background bg-foreground px-1 text-xs font-bold tabular-nums text-background">
                          {inviteCount}
                        </span>
                      ) : null}
                    </button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Squad invites</DialogTitle>
                      <DialogDescription>Invites and updates for your squad.</DialogDescription>
                    </DialogHeader>
                    {remote.received.map((invite) => (
                      <div
                        key={invite.id}
                        className="flex flex-wrap items-center gap-3 border-b border-border py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{invite.inviter_name} invited you</p>
                          <p className="text-sm text-muted-foreground">Join {invite.squad_name}?</p>
                        </div>
                        <Button
                          onClick={() =>
                            remote.answer(invite, true).then(
                              () => toast.success(`You joined ${invite.squad_name}.`),
                              () => toast.error("That invite isn't available anymore."),
                            )
                          }
                        >
                          Accept
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() =>
                            void remote
                              .answer(invite, false)
                              .catch(() => toast.error("Could not decline the invite. Try again."))
                          }
                        >
                          Decline
                        </Button>
                      </div>
                    ))}
                    {state.squadInvites.length ? (
                      <ul className="divide-y divide-border">
                        {state.squadInvites.map((invite) => (
                          <li key={invite.id} className="flex flex-wrap items-center gap-3 py-3">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium">
                                {invite.direction === "received"
                                  ? `${invite.personName} invited you`
                                  : `Invite sent to ${invite.personName}`}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {invite.direction === "received"
                                  ? "Add them to your squad?"
                                  : "Waiting for them to respond"}
                              </p>
                            </div>
                            {invite.direction === "received" ? (
                              <div className="flex gap-2">
                                <Button onClick={() => actions.acceptSquadInvite(invite.id)}>
                                  Accept
                                </Button>
                                <Button
                                  variant="ghost"
                                  onClick={() => actions.dismissSquadInvite(invite.id)}
                                >
                                  Decline
                                </Button>
                              </div>
                            ) : (
                              <Button
                                variant="ghost"
                                onClick={() => actions.dismissSquadInvite(invite.id)}
                              >
                                Dismiss
                              </Button>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : remote.received.length ? null : (
                      <p className="py-4 text-sm text-muted-foreground">
                        You’re all caught up. Squad invites will show up here.
                      </p>
                    )}
                  </DialogContent>
                </Dialog>
                <Link
                  to="/profile"
                  activeOptions={{ exact: true }}
                  aria-label="Your profile"
                  data-nav="profile"
                  className="press group grid h-11 w-11 place-items-center rounded-[30%]"
                >
                  <span className="rounded-[30%] group-aria-[current=page]:ring-2 group-aria-[current=page]:ring-ring group-aria-[current=page]:ring-offset-2 group-aria-[current=page]:ring-offset-background">
                    <Avatar name={state.name} you size={40} imageUrl={state.avatarUrl} />
                  </span>
                </Link>
              </div>
            </div>
          </div>
        </header>

        {children}

        <GlassTabBar tabs={tabs} active={active} />
      </div>
    </Framed.Provider>
  );
}

/**
 * A page's content area. `wide` for the widest layouts, `compact` for pages that fit the phone
 * screen (no bottom padding, no sideways overflow), `bleed` gives the whole area under the header
 * to the page, for the map. Outside AppFrame (a not-found thrown by a page), it brings the frame.
 */
export function AppShell({
  children,
  wide = false,
  compact = false,
  bleed = false,
}: {
  children: ReactNode;
  wide?: boolean;
  compact?: boolean;
  bleed?: boolean;
}) {
  const framed = useContext(Framed);
  const main = bleed ? (
    <main id="main" tabIndex={-1} data-bleed="" className="relative min-h-0 flex-1 outline-none">
      {children}
    </main>
  ) : (
    <main
      id="main"
      tabIndex={-1}
      {...(compact ? { "data-compact": "" } : {})}
      className={`safe-x mx-auto pt-5 outline-none md:pt-10 ${compact ? "pb-0 md:pb-16" : "pb-16"} ${wide ? "max-w-7xl" : "max-w-5xl"}`}
    >
      {children}
    </main>
  );
  return framed ? main : <AppFrame>{main}</AppFrame>;
}

/*
 * Desktop nav: the active page gets a hand-drawn clover squiggle that slides between items and
 * draws itself in, instead of a text underline that jumps. (Its width eases rather than scaling,
 * so the hand-drawn stroke keeps its weight and the draw-in dash stays whole.)
 */
function DesktopNav({
  pathname,
  activeQuest,
}: {
  pathname: string;
  activeQuest: { id: string } | null;
}) {
  const list = useRef<HTMLElement>(null);
  const squiggle = useRef<SVGSVGElement>(null);
  const [bar, setBar] = useState<{ x: number; w: number } | null>(null);
  const active = activeIndexFor(pathname, activeQuest?.id ?? null);
  const drawn = useRef(active);
  const [glide, setGlide] = useState(false);

  useLayoutEffect(() => {
    const measure = () => {
      const el = list.current?.querySelector<HTMLElement>(`[data-nav-index="${active}"]`);
      setBar(el ? { x: el.offsetLeft, w: el.offsetWidth } : null);
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (list.current) observer.observe(list.current);
    return () => observer.disconnect();
  }, [active, activeQuest?.id]);

  // The first placement lands without sliding in from the left edge; after that it glides.
  useEffect(() => {
    if (!bar || glide) return;
    const frame = requestAnimationFrame(() => setGlide(true));
    return () => cancelAnimationFrame(frame);
  }, [bar, glide]);

  // Draw the squiggle in when the page changes (not on resize or when the nav shifts).
  useEffect(() => {
    if (drawn.current === active) return;
    drawn.current = active;
    const path = squiggle.current?.querySelector("path");
    if (!path || reducedMotion()) return;
    path.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], {
      duration: 380,
      easing: EASE_OUT,
    });
  }, [active]);

  return (
    <nav ref={list} aria-label="Main" className="relative hidden items-center gap-7 md:flex">
      {NAV.map(({ to, label }, index) => (
        <Link
          key={to}
          to={to}
          data-nav={label.toLowerCase()}
          data-nav-index={index}
          activeOptions={{ exact: to === "/" }}
          activeProps={{ className: "text-foreground" }}
          className="relative py-2 text-[15px] font-medium text-muted-foreground transition-colors duration-(--dur-quick) hover:text-foreground aria-[current=page]:font-semibold"
        >
          {label}
        </Link>
      ))}
      {activeQuest ? (
        <Link
          to="/go/$questId"
          params={{ questId: activeQuest.id }}
          data-nav-index={NAV.length}
          className="relative inline-flex items-center gap-2 py-2 text-[15px] font-semibold text-foreground"
        >
          <span aria-hidden className="live-dot relative h-2 w-2 rounded-full bg-primary" />
          Active quest
        </Link>
      ) : null}
      <svg
        ref={squiggle}
        aria-hidden
        viewBox="0 0 44 8"
        preserveAspectRatio="none"
        className={`pointer-events-none absolute -bottom-1 left-0 h-2 text-ring ${glide ? "transition-[transform,width,opacity] duration-(--dur-base) ease-(--ease-out)" : ""}`}
        style={
          bar ? { width: bar.w, transform: `translateX(${bar.x}px)` } : { width: 0, opacity: 0 }
        }
      >
        <path
          d="M1 5 C 8 1, 14 9, 22 5 S 36 1, 43 5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          pathLength={1}
          strokeDasharray={1}
        />
      </svg>
    </nav>
  );
}
