import * as React from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";

import { cn } from "@/lib/utils";
import { buttonClass } from "@/components/ui-kit";

/*
 * A confirmation on paper: a white sheet with a hairline edge over a soft ink scrim. It settles in
 * (ease-out, from a touch below) and leaves quicker than it came (ease-in). Footer buttons are the
 * ui-kit ones: Cancel is the quiet outline, the action is the clover stamp, or danger ink when it
 * destroys something (<AlertDialogAction variant="destructive">).
 */

const AlertDialog = AlertDialogPrimitive.Root;

const AlertDialogTrigger = AlertDialogPrimitive.Trigger;

const AlertDialogPortal = AlertDialogPrimitive.Portal;

const AlertDialogOverlay = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-foreground/35 duration-(--dur-base) ease-(--ease-out) data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-(--dur-quick) data-[state=closed]:ease-(--ease-in)",
      className,
    )}
    {...props}
    ref={ref}
  />
));
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName;

const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
>(({ className, onOpenAutoFocus, onCloseAutoFocus, ...props }, ref) => {
  // A controlled alert (opened from state, with no Trigger) would drop focus on <body> when it
  // closes. Remember what had focus when it opened and hand focus back there.
  const returnFocus = React.useRef<HTMLElement | null>(null);
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        ref={ref}
        onOpenAutoFocus={(event) => {
          returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          onOpenAutoFocus?.(event);
        }}
        onCloseAutoFocus={(event) => {
          onCloseAutoFocus?.(event);
          const target = returnFocus.current;
          returnFocus.current = null;
          if (event.defaultPrevented || !target?.isConnected || target === document.body) return;
          event.preventDefault();
          target.focus({ preventScroll: true });
        }}
        className={cn(
          "fixed left-[50%] top-[50%] z-50 grid w-[calc(100%-1.5rem)] max-w-md translate-x-[-50%] translate-y-[-50%] gap-6 rounded-xl border border-border bg-card p-6 shadow-(--shadow-dialog) sm:w-full sm:p-7",
          "duration-(--dur-base) ease-(--ease-out) data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-97 data-[state=open]:slide-in-from-bottom-2",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-98 data-[state=closed]:duration-(--dur-quick) data-[state=closed]:ease-(--ease-in)",
          className,
        )}
        {...props}
      />
    </AlertDialogPortal>
  );
});
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName;

const AlertDialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col gap-2 text-left", className)} {...props} />
);
AlertDialogHeader.displayName = "AlertDialogHeader";

/** Stacked full-width on phones (the action above Cancel); a right-aligned row from sm up. */
const AlertDialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3", className)} {...props} />
);
AlertDialogFooter.displayName = "AlertDialogFooter";

const AlertDialogTitle = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Title
    ref={ref}
    className={cn("text-xl font-semibold leading-tight tracking-[-0.01em] text-balance", className)}
    {...props}
  />
));
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName;

const AlertDialogDescription = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Description
    ref={ref}
    className={cn("text-[15px] leading-relaxed text-muted-foreground text-pretty", className)}
    {...props}
  />
));
AlertDialogDescription.displayName = AlertDialogPrimitive.Description.displayName;

type AlertActionVariant = "primary" | "ink" | "destructive";

/*
 * Danger ink: the outline button's shape with the destructive color for its text and edge, and a
 * faint wash of it on hover. It reads as "careful" without shouting a red slab across the sheet.
 */
const DESTRUCTIVE =
  "border-destructive text-destructive hover:bg-[color-mix(in_srgb,var(--destructive)_8%,var(--card))]";

function footerButtonClass(variant: AlertActionVariant | "outline") {
  const base = variant === "destructive" ? cn(buttonClass({ variant: "outline" }), DESTRUCTIVE) : buttonClass({ variant });
  return cn(base, "w-full sm:w-auto");
}

const AlertDialogAction = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action> & {
    /** primary (default) is the clover stamp; destructive is danger ink for removing or deleting. */
    variant?: AlertActionVariant;
  }
>(({ className, variant = "primary", ...props }, ref) => (
  <AlertDialogPrimitive.Action ref={ref} className={cn(footerButtonClass(variant), className)} {...props} />
));
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName;

const AlertDialogCancel = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Cancel>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Cancel ref={ref} className={cn(footerButtonClass("outline"), className)} {...props} />
));
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName;

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};
