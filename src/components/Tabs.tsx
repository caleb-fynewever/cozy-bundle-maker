import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tab<T extends string> = { id: T; label: ReactNode; controls?: string };

/**
 * Text tabs with one deep-clover underline that slides to the active tab instead of jumping (it
 * lands in place on first show, then glides).
 * Keyboard: arrow keys move between tabs (roving tabindex), like a real tablist.
 */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  idPrefix,
  className,
}: {
  tabs: Tab<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  idPrefix: string;
  className?: string;
}) {
  const list = useRef<HTMLDivElement>(null);
  const [bar, setBar] = useState<{ x: number; w: number } | null>(null);
  const [glide, setGlide] = useState(false);

  useLayoutEffect(() => {
    const measure = () => {
      const el = list.current?.querySelector<HTMLElement>(`[data-tab="${value}"]`);
      if (el) setBar({ x: el.offsetLeft, w: el.offsetWidth });
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (list.current) observer.observe(list.current);
    return () => observer.disconnect();
  }, [value, tabs.length]);

  useEffect(() => {
    if (!bar || glide) return;
    const frame = requestAnimationFrame(() => setGlide(true));
    return () => cancelAnimationFrame(frame);
  }, [bar, glide]);

  function move(from: number, step: number) {
    const next = tabs[(from + step + tabs.length) % tabs.length]!;
    onChange(next.id);
    list.current?.querySelector<HTMLElement>(`[data-tab="${next.id}"]`)?.focus();
  }

  return (
    <div ref={list} role="tablist" aria-label={label} className={cn("relative flex border-b border-border", className)}>
      {tabs.map((tab, index) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            id={`${idPrefix}-${tab.id}-tab`}
            data-tab={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            // Only the shown panel exists to point at.
            aria-controls={selected ? tab.controls : undefined}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight") { event.preventDefault(); move(index, 1); }
              if (event.key === "ArrowLeft") { event.preventDefault(); move(index, -1); }
            }}
            className={cn(
              "relative min-h-12 cursor-pointer px-4 text-sm font-semibold transition-colors duration-(--dur-quick)",
              selected ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        );
      })}
      <span
        aria-hidden
        className={cn("pointer-events-none absolute -bottom-px left-0 h-0.5 w-px origin-left rounded-full bg-ring", glide && "transition-transform duration-(--dur-base) ease-(--ease-out)")}
        style={bar ? { transform: `translateX(${bar.x}px) scaleX(${bar.w})` } : { opacity: 0 }}
      />
    </div>
  );
}
