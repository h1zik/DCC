import { Skeleton } from "@/components/ui/skeleton";

export default function ScheduleLoading() {
  return (
    <div className="flex w-full flex-col gap-6">
      <Skeleton className="h-24 w-full rounded-xl" />
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-[560px] w-full rounded-xl" />
      </div>
    </div>
  );
}
