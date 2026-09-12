import { cn } from "@/lib/cn";
import { Panel } from "./brand";

/** Placeholder block shown by loading.tsx while a page renders on the server. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("rounded-xl bg-navy/10 motion-safe:animate-pulse", className)} />;
}

/** Page title + subtitle placeholder, same footprint as the real headings. */
export function HeadingSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-8 w-48 md:h-9" />
      <Skeleton className="h-4 w-64 max-w-full" />
    </div>
  );
}

export function PanelSkeleton({ className, rows = 4 }: { className?: string; rows?: number }) {
  return (
    <Panel className={cn("flex flex-col gap-3 p-4", className)}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={cn("h-10", i % 3 === 2 && "w-2/3")} />
      ))}
    </Panel>
  );
}

/** Wraps a loading state so screen readers hear one "Loading…" instead of nothing. */
export function LoadingRegion({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div role="status" aria-busy className={className}>
      <span className="sr-only">Loading…</span>
      {children}
    </div>
  );
}
