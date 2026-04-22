import { Skeleton } from "@/components/ui/skeleton";

export default function RoomLoading() {
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-1 pb-8 sm:px-0">
      <div className="rounded-xl border p-4">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="mt-3 h-4 w-40" />
        <div className="mt-4 flex flex-wrap gap-2">
          <Skeleton className="h-9 w-28 rounded-md" />
          <Skeleton className="h-9 w-28 rounded-md" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
