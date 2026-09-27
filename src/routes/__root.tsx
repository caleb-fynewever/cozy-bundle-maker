import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Doodle } from "@/components/Doodle";
import {
  Outlet,
  Link,
  Navigate,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { useAuth } from "../lib/auth";
import { bindUser, setState, useUserState } from "../lib/store";
import { getMyProfile } from "../lib/profiles.functions";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AppFrame, AppShell } from "@/components/AppShell";
import { Button, PageHeader, buttonClass, textButtonClass } from "@/components/ui-kit";

/*
 * The 404 and error pages live inside the notebook too: a dashed trail leaves your clover dot and
 * wanders off the page. On a 404 it ends in a hand-drawn X ("this trail goes nowhere"); on an error
 * it snarls into a knot. The drawing plays once (styles/shell.css); reduced motion shows it finished.
 */
const TRAIL_START = { cx: 22, cy: 112 };
const TRAIL_TO_X =
  "M36 111 C 58 113, 70 86, 98 88 C 126 90, 128 118, 158 116 C 176 114, 186 100, 200 88 C 210 78, 224 66, 234 76 C 244 86, 234 104, 220 102 C 206 100, 204 84, 216 78 C 232 70, 256 70, 272 84 C 286 96, 306 96, 324 84";
const TRAIL_TO_KNOT =
  "M36 111 C 58 113, 70 86, 98 88 C 126 90, 128 118, 158 116 C 184 114, 196 96, 214 92 C 228 89, 238 92, 246 90";
const X_STROKES = [
  "M338 63 C 346 71, 356 83, 369 97",
  "M367 60 C 362 68, 357 75, 351 82 S 341 92, 334 97",
];
const KNOT =
  "M250 90 C 262 66, 300 62, 304 84 C 308 104, 276 110, 268 94 C 260 78, 284 64, 300 74 C 318 86, 306 108, 288 104 C 270 100, 272 76, 292 72 C 314 68, 330 84, 322 98 C 316 108, 298 102, 302 90 C 306 80, 326 84, 336 100";

function TrailArt({
  variant,
  note,
  wanderer = false,
}: {
  variant: "dead-end" | "tangled";
  note: string;
  wanderer?: boolean;
}) {
  const deadEnd = variant === "dead-end";
  const svgProps = {
    viewBox: "0 0 400 150",
    fill: "none",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "absolute inset-0 h-full w-full",
  };
  return (
    <div
      aria-hidden
      className="trail-art relative aspect-[8/3] w-full max-w-[30rem] select-none md:justify-self-end"
    >
      <svg
        {...svgProps}
        className={`${svgProps.className} trail-art__dashes`}
        data-length={deadEnd ? undefined : "short"}
      >
        <path
          d={deadEnd ? TRAIL_TO_X : TRAIL_TO_KNOT}
          stroke="currentColor"
          strokeWidth="2.4"
          strokeDasharray="6 8"
        />
      </svg>
      <svg {...svgProps}>
        {wanderer ? null : (
          <circle
            className="trail-art__start fill-primary"
            {...TRAIL_START}
            r="6.5"
            stroke="currentColor"
            strokeWidth="1.75"
          />
        )}
        {deadEnd ? (
          <g className="trail-art__mark">
            {X_STROKES.map((d, index) => (
              <path
                key={d}
                d={d}
                pathLength={1}
                className="trail-art__stroke"
                stroke="currentColor"
                strokeWidth="3.4"
                style={{ "--at": `${900 + index * 150}ms` } as CSSProperties}
              />
            ))}
          </g>
        ) : (
          <path
            d={KNOT}
            pathLength={1}
            className="trail-art__stroke"
            stroke="currentColor"
            strokeWidth="2.6"
            style={{ "--at": "760ms", "--draw": "820ms" } as CSSProperties}
          />
        )}
      </svg>
      {wanderer ? (
        // The lost little alien is who walked this trail: it stands where the dashes begin.
        <Doodle
          name="weird"
          size={40}
          className="trail-art__start absolute left-[5.5%] top-[72%] -translate-x-1/2 -translate-y-1/2 -rotate-6"
        />
      ) : null}
      <p
        className="trail-art__note absolute right-0 top-[16%] -rotate-2 px-1 py-0.5 font-hand text-xl leading-none text-muted-foreground md:text-[1.375rem]"
        style={{ "--at": deadEnd ? "1250ms" : "1500ms" } as CSSProperties}
      >
        {note}
      </p>
    </div>
  );
}

/** Title, a line of copy and the way out on one side; the drawing on the other (above, on phones). */
function TrailPage({
  art,
  title,
  body,
  actions,
}: {
  art: ReactNode;
  title: string;
  body: string;
  actions: ReactNode;
}) {
  return (
    <section className="grid gap-6 md:min-h-[min(calc(100dvh-176px),32rem)] md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:items-center md:gap-12">
      <div className="order-2 md:order-1">
        <PageHeader title={title} bare className="mb-3 pb-0" />
        <p className="max-w-[36ch] text-pretty text-muted-foreground">{body}</p>
        <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-3">{actions}</div>
      </div>
      <div className="order-1 md:order-2">{art}</div>
    </section>
  );
}

function NotFoundComponent() {
  return (
    <AppShell>
      <TrailPage
        art={<TrailArt variant="dead-end" note="this trail goes nowhere" wanderer />}
        title="Wrong turn"
        body="That link doesn’t lead anywhere anymore. Plenty of things near you still do."
        actions={
          <>
            <Link to="/" className={buttonClass({ variant: "primary" })}>
              Back to quests
            </Link>
            <Link to="/map" className={textButtonClass}>
              Open the map
            </Link>
          </>
        }
      />
    </AppShell>
  );
}

/*
 * The error page can't lean on AppShell (the error may have come from it, or from the store it
 * reads), so it draws the same header by hand: paper, the wordmark, one hairline.
 */
function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background">
        <div className="safe-x mx-auto flex h-16 max-w-7xl items-center md:h-[72px]">
          <a
            href="/"
            className="press font-hand text-[28px] leading-none md:text-[34px]"
            aria-label="wego home"
          >
            wego
          </a>
        </div>
      </header>
      <main
        id="main"
        tabIndex={-1}
        className="safe-x mx-auto max-w-5xl pb-16 pt-5 outline-none md:pt-10"
      >
        <TrailPage
          art={<TrailArt variant="tangled" note="got a little tangled" />}
          title="This page didn't load"
          body="Something went wrong on our end. You can try refreshing or head back home."
          actions={
            <>
              <Button
                onClick={() => {
                  router.invalidate();
                  reset();
                }}
              >
                Try again
              </Button>
              <a href="/" className={buttonClass({ variant: "outline" })}>
                Go home
              </a>
            </>
          }
        />
      </main>
    </div>
  );
}

/*
 * Skip link: jumps keyboard users past the header to the page's <main id="main">. It moves focus
 * itself so the URL never changes (a bare hash would make the router re-run the route).
 */
function SkipLink() {
  return (
    <a
      href="#main"
      className="skip-link"
      onClick={(event) => {
        const main = document.getElementById("main") ?? document.querySelector("main");
        if (!main) return;
        event.preventDefault();
        if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
        main.focus();
      }}
    >
      Skip to content
    </a>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      // Tints Safari's toolbar on iPhone to the paper background.
      { name: "theme-color", content: "#ECF2F7" },
      { title: "wego" },
      {
        name: "description",
        content: "wego turns 'what should we do?' into a personalized mission near you.",
      },
      { property: "og:site_name", content: "wego" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=Schoolbell&display=swap",
      },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <SkipLink />
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const { session, loading } = useAuth();
  const pathname = useRouterState({ select: (routerState) => routerState.location.pathname });
  const onAuthPage = pathname === "/auth";
  const onSetupPage = pathname === "/setup";
  const userState = useUserState();
  const userId = session?.user.id ?? null;
  const [checkedProfileFor, setCheckedProfileFor] = useState<string | null>(null);

  // Bind local state and restore the account profile before deciding whether
  // setup is needed. This avoids redirecting returning users to /setup first.
  useEffect(() => {
    if (loading) return;
    bindUser(userId);
    if (!userId) {
      setCheckedProfileFor(null);
      return;
    }
    let cancelled = false;
    getMyProfile()
      .then((profile) => {
        if (cancelled || !profile) return;
        setState((current) => ({
          ...current,
          configured: true,
          name: profile.name,
          handle: profile.handle,
          bio: profile.bio || current.bio,
          avatarUrl: profile.avatar_url ?? current.avatarUrl,
        }));
      })
      .catch(() => {
        /* offline or hiccup — fall back to this device's saved setup */
      })
      .finally(() => {
        if (!cancelled) setCheckedProfileFor(userId);
      });
    return () => {
      cancelled = true;
    };
  }, [loading, userId]);

  let body: ReactNode;
  if (loading || (userId && checkedProfileFor !== userId)) {
    body = <div className="min-h-screen bg-background" />;
  } else if (!session && !onAuthPage) {
    body = <Navigate to="/auth" replace />;
  } else if (session && !userState.configured && !onSetupPage) {
    body = <Navigate to="/setup" replace />;
  } else if (session && userState.configured && onSetupPage) {
    body = <Navigate to="/" replace />;
  } else {
    body = <Outlet />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      {session && userState.configured && !onAuthPage && !onSetupPage ? (
        <AppFrame>{body}</AppFrame>
      ) : (
        body
      )}
      <Toaster position="top-center" theme="light" />
    </QueryClientProvider>
  );
}
