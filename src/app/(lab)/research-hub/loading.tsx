import { Skeleton } from "@/components/ui/skeleton";

/**
 * Research Hub route skeleton aligned with the two-column layout:
 * desktop sidebar + main content with workflow, action center, and zone bento.
 */
export default function ResearchHubLoading() {
  return (
    <div className="flex w-full min-w-0 gap-6 lg:gap-8 animate-in fade-in duration-300 motion-reduce:animate-none">
      {/* Desktop sidebar placeholder */}
      <div className="hidden w-56 shrink-0 flex-col gap-3 lg:flex xl:w-60">
        <Skeleton className="h-10 w-full rounded-lg" />
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full rounded-lg" />
        ))}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-6">
        {/* Mobile sub-nav */}
        <div className="sticky top-0 -mt-2 h-11 border-b border-border/70 lg:hidden">
          <div className="flex items-center gap-2 overflow-hidden py-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-24 shrink-0 rounded-lg" />
            ))}
          </div>
        </div>

        {/* Page header */}
        <Skeleton className="h-36 w-full rounded-2xl" />

        <div className="grid gap-6 lg:grid-cols-[1fr_minmax(240px,280px)] lg:gap-8">
          <div className="flex flex-col gap-6">
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-48 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-36 rounded-2xl" />
              <Skeleton className="h-36 rounded-2xl" />
            </div>
          </div>
          <div className="hidden flex-col gap-4 lg:flex">
            <Skeleton className="h-72 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
