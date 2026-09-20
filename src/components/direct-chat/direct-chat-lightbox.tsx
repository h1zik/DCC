"use client";

import { useEffect } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  MessageSquareText,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type DirectChatLightboxImage = {
  id: string;
  src: string;
  fileName: string;
  messageId: string;
};

export type DirectChatLightboxState = {
  images: DirectChatLightboxImage[];
  index: number;
};

const controlButton =
  "inline-flex size-10 items-center justify-center rounded-full bg-white/10 text-white outline-none transition-colors hover:bg-white/20 focus-visible:ring-3 focus-visible:ring-white/60 disabled:pointer-events-none disabled:opacity-30";

/**
 * Penampil gambar di dalam aplikasi. Latar selalu gelap apa pun temanya —
 * foto dinilai paling netral di atas hitam, jadi warna di sini sengaja tidak
 * memakai token tema.
 */
export function DirectChatLightbox({
  state,
  onIndexChange,
  onClose,
  onShowInChat,
}: {
  state: DirectChatLightboxState | null;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  onShowInChat: (messageId: string) => void;
}) {
  const count = state?.images.length ?? 0;
  const index = state?.index ?? 0;
  const current = state?.images[index] ?? null;

  useEffect(() => {
    if (!state) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft" && index > 0) onIndexChange(index - 1);
      if (e.key === "ArrowRight" && index < count - 1) onIndexChange(index + 1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [state, index, count, onIndexChange]);

  return (
    <DialogPrimitive.Root
      open={Boolean(current)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/90 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <DialogPrimitive.Popup className="fixed inset-0 z-50 flex flex-col outline-none transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0">
          {current ? (
            <>
              <div className="flex shrink-0 items-center gap-2 p-3 text-white">
                <div className="min-w-0 flex-1 pl-1">
                  <DialogPrimitive.Title className="truncate text-sm font-medium">
                    {current.fileName}
                  </DialogPrimitive.Title>
                  {count > 1 ? (
                    <p className="text-xs text-white/60 tabular-nums">
                      {index + 1} dari {count}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className={cn(controlButton, "w-auto gap-1.5 px-3.5 text-xs font-medium")}
                  onClick={() => onShowInChat(current.messageId)}
                >
                  <MessageSquareText className="size-4" aria-hidden />
                  Lihat di chat
                </button>
                <a
                  href={current.src}
                  download={current.fileName}
                  className={controlButton}
                  aria-label="Unduh gambar"
                  title="Unduh"
                >
                  <Download className="size-4" />
                </a>
                <DialogPrimitive.Close className={controlButton} aria-label="Tutup">
                  <X className="size-4" />
                </DialogPrimitive.Close>
              </div>
              <div
                className="relative flex min-h-0 flex-1 items-center justify-center px-3 pb-4 sm:px-16"
                onClick={(e) => {
                  if (e.target === e.currentTarget) onClose();
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={current.id}
                  src={current.src}
                  alt={current.fileName}
                  className="max-h-full max-w-full rounded-md object-contain"
                />
                {count > 1 ? (
                  <>
                    <button
                      type="button"
                      className={cn(controlButton, "absolute top-1/2 left-3 -translate-y-1/2")}
                      disabled={index === 0}
                      onClick={() => onIndexChange(index - 1)}
                      aria-label="Gambar sebelumnya"
                    >
                      <ChevronLeft className="size-5" />
                    </button>
                    <button
                      type="button"
                      className={cn(controlButton, "absolute top-1/2 right-3 -translate-y-1/2")}
                      disabled={index === count - 1}
                      onClick={() => onIndexChange(index + 1)}
                      aria-label="Gambar berikutnya"
                    >
                      <ChevronRight className="size-5" />
                    </button>
                  </>
                ) : null}
              </div>
            </>
          ) : null}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
