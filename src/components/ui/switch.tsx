import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

/*
 * An on/off switch in the app's ink: a paper track with an --input edge when off, solid ink when
 * on, and a white thumb that gives under the finger and springs across. It draws at 44x26 and its
 * hit area is 44px tall. Styles live in styles/shell.css (.ink-switch).
 *
 * Wrap it in a <label> with its text, or give it an aria-label.
 */
const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root className={cn("ink-switch peer", className)} {...props} ref={ref}>
    <SwitchPrimitives.Thumb className="ink-switch__thumb pointer-events-none" />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
