import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton isi halaman KOL Hub (sidebar sudah dirender layout). */
export default function KolHubLoading() {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6 animate-in fade-in duration-300 motion-reduce:animate-none">
      <Skeleton className="h-20 w-full rounded-2xl" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
      </div>
      <Skeleton className="h-72 w-full rounded-2xl" />
    </div>
  );
}
