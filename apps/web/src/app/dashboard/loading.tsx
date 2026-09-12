import { HeadingSkeleton, LoadingRegion, PanelSkeleton, Skeleton } from "@/components/ui/skeleton";

// Instant feedback for dashboard tabs; the sidebar/top bar (layout) stays put meanwhile.
export default function DashboardLoading() {
  return (
    <LoadingRegion className="flex flex-col gap-5">
      <HeadingSkeleton />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-3xl" />
        ))}
      </div>
      <PanelSkeleton rows={6} />
    </LoadingRegion>
  );
}
