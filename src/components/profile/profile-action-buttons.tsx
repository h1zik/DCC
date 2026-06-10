"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Link2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { getOrCreateDirectConversation } from "@/actions/direct-messages";
import { actionErrorMessage } from "@/lib/action-error-message";
import { Button } from "@/components/ui/button";

export function CopyProfileLinkButton({ sharePath }: { sharePath: string }) {
  async function onCopy() {
    try {
      const url =
        typeof window !== "undefined"
          ? `${window.location.origin}${sharePath}`
          : sharePath;
      await navigator.clipboard.writeText(url);
      toast.success("Tautan profil disalin.");
    } catch {
      toast.error("Tidak bisa menyalin — coba salin manual.");
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={() => void onCopy()}>
      <Link2 className="size-4" />
      Salin tautan
    </Button>
  );
}

export function MessageUserButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      try {
        const { conversationId } = await getOrCreateDirectConversation(userId);
        router.push(`/messages?c=${conversationId}`);
      } catch (e) {
        toast.error(actionErrorMessage(e, "Gagal memulai percakapan."));
      }
    });
  }

  return (
    <Button type="button" size="sm" disabled={pending} onClick={onClick}>
      <MessageSquare className="size-4" />
      {pending ? "Membuka…" : "Kirim pesan"}
    </Button>
  );
}
