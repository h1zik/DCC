"use client";

import { useState, useTransition } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { submitAiOutputFeedback } from "@/actions/ai-feedback";
import { actionErrorMessage } from "@/lib/action-error-message";
import { cn } from "@/lib/utils";

/**
 * Thumbs up/down pada output AI — menutup learning loop yang selama ini absen.
 * Vote tersimpan per (artefak, user); vote ulang menimpa.
 */
export function AiFeedbackButtons({
  module,
  artifactType,
  artifactId,
  aiMeta,
  className,
  label = "Output AI ini membantu?",
}: {
  module: string;
  artifactType: string;
  artifactId: string;
  /** Snapshot aiMeta artefak — agar feedback bisa dikaitkan ke model/prompt. */
  aiMeta?: unknown;
  className?: string;
  label?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [voted, setVoted] = useState<"UP" | "DOWN" | null>(null);

  const vote = (verdict: "UP" | "DOWN") => {
    startTransition(async () => {
      try {
        await submitAiOutputFeedback({
          module,
          artifactType,
          artifactId,
          verdict,
          aiMeta,
        });
        setVoted(verdict);
        toast.success(
          verdict === "UP"
            ? "Terima kasih — feedback tersimpan."
            : "Tercatat. Feedback negatif membantu kalibrasi kualitas AI.",
        );
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menyimpan feedback."));
      }
    });
  };

  return (
    <div
      className={cn(
        "text-muted-foreground flex items-center gap-1.5 text-[11px]",
        className,
      )}
    >
      <span>{label}</span>
      <button
        type="button"
        disabled={pending}
        onClick={() => vote("UP")}
        title="Membantu"
        className={cn(
          "rounded-md p-1 transition-colors hover:text-emerald-600 disabled:opacity-50 dark:hover:text-emerald-400",
          voted === "UP" && "text-emerald-600 dark:text-emerald-400",
        )}
      >
        <ThumbsUp className="size-3.5" aria-hidden />
        <span className="sr-only">Membantu</span>
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => vote("DOWN")}
        title="Tidak akurat / tidak membantu"
        className={cn(
          "rounded-md p-1 transition-colors hover:text-red-600 disabled:opacity-50 dark:hover:text-red-400",
          voted === "DOWN" && "text-red-600 dark:text-red-400",
        )}
      >
        <ThumbsDown className="size-3.5" aria-hidden />
        <span className="sr-only">Tidak membantu</span>
      </button>
    </div>
  );
}
