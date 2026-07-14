import { Skeleton } from "@/components/ui/skeleton";

export default function LabLoading() {
  return (
    <div className="flex w-full flex-col gap-6">
      <div className="space-y-2">
        <Skeleton className="lab-shimmer h-8 w-64" />
        <Skeleton className="lab-shimmer h-4 w-full max-w-xl" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="lab-shimmer h-28 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="lab-shimmer h-72 w-full rounded-2xl" />
    </div>
  );
}
