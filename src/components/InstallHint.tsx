import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/*
 * One-time install hint. Shown only after a brand-new account is created (the signup path marks
 * the hint pending), only on phone-sized screens, and never again once dismissed or once the app
 * already runs from the home screen.
 */

const KEY = "wego:install-hint";

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && navigator.standalone === true)
  );
}

function isIos() {
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (/Mac/.test(ua) && "ontouchend" in document);
}

export function markInstallHintPending() {
  try {
    if (localStorage.getItem(KEY) !== "done") localStorage.setItem(KEY, "pending");
  } catch {
    /* storage may be unavailable; the hint just doesn't show */
  }
}

export function InstallHint() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let flag = "";
    try {
      flag = localStorage.getItem(KEY) ?? "";
    } catch {
      /* ignore */
    }
    if (flag !== "pending" || isStandalone()) return;
    if (!window.matchMedia("(max-width: 639px)").matches) return;
    const timer = window.setTimeout(() => setOpen(true), 600);
    return () => window.clearTimeout(timer);
  }, []);

  function dismiss() {
    setOpen(false);
    try {
      localStorage.setItem(KEY, "done");
    } catch {
      /* ignore */
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) dismiss();
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader className="text-left">
          <DialogTitle className="text-xl leading-tight">Keep wego on your phone</DialogTitle>
          <DialogDescription asChild>
            <div>
              <p className="font-hand text-lg leading-snug text-muted-foreground">
                it takes ten seconds and opens like a real app
              </p>
              {isIos() ? (
                <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                  <li>
                    Tap the <strong className="text-foreground">Share</strong> button in Safari
                  </li>
                  <li>
                    Choose <strong className="text-foreground">Add to Home Screen</strong>
                  </li>
                  <li>Tap Add — the wego icon lands on your home screen</li>
                </ol>
              ) : (
                <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                  <li>
                    Open the browser menu (
                    <strong className="text-foreground">⋮</strong> in Chrome)
                  </li>
                  <li>
                    Choose <strong className="text-foreground">Install app</strong> or Add to Home
                    screen
                  </li>
                </ol>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>
        <button
          type="button"
          onClick={dismiss}
          className="min-h-11 w-full rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
        >
          Got it
        </button>
      </DialogContent>
    </Dialog>
  );
}
