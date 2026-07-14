import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton route Brand & Creative Hub — sejajar dengan layout dua kolom. */
export default function BrandHubLoading() {
  return (
    <div className="flex w-full min-w-0 gap-6 lg:gap-8 animate-in fade-in duration-300 motion-reduce:animate-none">
      <div className="hidden w-56 shrink-0 flex-col gap-3 lg:flex xl:w-60">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-8 w-full rounded-lg" />
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full rounded-lg" />
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <Skeleton className="h-36 w-full rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    </div>
  );
}
