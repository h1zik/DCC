"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addRoomMessage } from "@/actions/room-messages";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function RoomChatForm({ roomId }: { roomId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const taRef = useRef<HTMLTextAreaElement>(null);

  function submit() {
    const text = body.trim();
    if (!text || pending) return;
    startTransition(async () => {
      try {
        await addRoomMessage(roomId, text);
        setBody("");
        router.refresh();
        taRef.current?.focus();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Gagal mengirim.");
      }
    });
  }

  return (
    <div className="border-border bg-card flex flex-col gap-2 rounded-xl border p-3">
      <Textarea
        ref={taRef}
        rows={3}
        placeholder="Tulis pesan untuk grup ruangan ini…"
        value={body}
        disabled={pending}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
      />
      <div className="flex justify-end">
        <Button type="button" disabled={pending || !body.trim()} onClick={submit}>
          {pending ? "Mengirim…" : "Kirim"}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        Enter untuk kirim · Shift+Enter baris baru
      </p>
    </div>
  );
}
