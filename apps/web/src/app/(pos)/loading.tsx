import { HeadingSkeleton, LoadingRegion, PanelSkeleton, Skeleton } from "@/components/ui/skeleton";

// Shown the moment a register tab is tapped (and prefetched with the link), so Safari
// never sits on the old page while the server renders the new one.
export default function PosLoading() {
  return (
    <LoadingRegion className="lg:grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:gap-6">
      <div className="flex flex-col gap-4">
        <HeadingSkeleton />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-40 rounded-3xl" />
          ))}
        </div>
      </div>
      <PanelSkeleton className="mt-4 hidden lg:mt-0 lg:flex" rows={5} />
    </LoadingRegion>
  );
}
