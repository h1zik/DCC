"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileQuestion } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * View custom dihapus, DB di-reset, atau tautan bookmark sudah tidak valid.
 * `roomId` diambil dari URL karena halaman ini tidak menerima params.
 */
export default function RoomViewNotFound() {
  const pathname = usePathname() ?? "";
  const match = /^\/room\/([^/]+)\/view\//.exec(pathname);
  const roomId = match?.[1] ?? null;

  return (
    <div className="border-border bg-card mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl border p-8 text-center shadow-sm">
      <span className="bg-muted text-muted-foreground inline-flex size-12 items-center justify-center rounded-full">
        <FileQuestion className="size-6" aria-hidden />
      </span>
      <div className="space-y-1">
        <h1 className="text-foreground text-lg font-semibold tracking-tight">
          View tidak ditemukan
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Halaman view ini tidak ada di database. Biasanya karena view sudah
          dihapus oleh manager, database di-reset, atau tautan yang disimpan
          sudah kedaluwarsa.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {roomId ? (
          <Link
            href={`/room/${roomId}/tasks`}
            className={cn(buttonVariants({ variant: "default" }))}
          >
            Kembali ke Tasks ruangan
          </Link>
        ) : (
          <Link href="/tasks" className={cn(buttonVariants({ variant: "default" }))}>
            Kembali ke Tasks
          </Link>
        )}
        {roomId ? (
          <Link
            href={`/room/${roomId}`}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Ringkasan ruangan
          </Link>
        ) : null}
      </div>
    </div>
  );
}
