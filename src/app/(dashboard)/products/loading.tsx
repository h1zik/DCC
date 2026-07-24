import { Skeleton } from "@/components/ui/skeleton";

export default function ProductsLoading() {
  return (
    <div className="flex w-full flex-col gap-6">
      <Skeleton className="h-24 w-full rounded-xl" />
      <div className="flex flex-col gap-4">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    </div>
  );
}
