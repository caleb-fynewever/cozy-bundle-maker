import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";

import { cn } from "@/lib/utils";

/*
 * A checkbox in the app's ink: white with an --input edge at rest, solid ink when checked, and the
 * check draws itself in (draw-check). It draws at 20px and answers to a 44px target. Styles live
 * in styles/shell.css (.ink-check).
 */
const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root ref={ref} className={cn("ink-check group peer", className)} {...props}>
    <CheckboxPrimitive.Indicator className="grid place-content-center text-current">
      <Check aria-hidden className="draw-check h-3.5 w-3.5 group-data-[state=indeterminate]:hidden" strokeWidth={3} />
      <Minus aria-hidden className="hidden h-3.5 w-3.5 group-data-[state=indeterminate]:block" strokeWidth={3} />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
