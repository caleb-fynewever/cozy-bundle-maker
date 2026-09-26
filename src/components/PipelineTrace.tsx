import type { Trace } from "@/lib/engine";

export function PipelineTrace({
  trace,
  radiusMi,
  working,
}: {
  trace: Trace;
  radiusMi: number;
  working: boolean;
}) {
  const steps = [
    { label: "candidates", value: trace.candidates },
    { label: "viable", value: trace.viable },
    { label: "personalized", value: trace.personalized },
    { label: "diverse", value: trace.diverse },
  ];

  return (
    <div
      className="rounded-2xl border border-border bg-surface/70 px-4 py-3 font-mono text-xs"
      aria-live="polite"
    >
      <p className="text-muted-foreground">
        {working
          ? `Analyzing your group's taste · searching within ${radiusMi} mi…`
          : `Engine run complete · search radius ${radiusMi} mi`}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        {steps.map((step, index) => (
          <span key={step.label} className="flex items-center gap-2">
            <span className={working ? "text-muted-foreground" : "text-primary"}>
              {working ? "··" : step.value} {step.label}
            </span>
            {index < steps.length - 1 ? <span aria-hidden className="text-border-strong">→</span> : null}
          </span>
        ))}
      </div>
    </div>
  );
}
