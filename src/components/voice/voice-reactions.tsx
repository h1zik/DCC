"use client";

import { useState } from "react";
import { useRoomContext } from "@livekit/components-react";
import { Smile } from "lucide-react";
import { VOICE_REACTION_EMOJIS } from "@/lib/voice-events";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { controlButtonClassName } from "./voice-controls";
import { sendVoiceEvent, useVoiceEvents } from "./voice-events-store";

/** Emoji reaksi yang melayang naik di atas stage lalu menghilang. */
export function VoiceReactionLayer() {
  const reactions = useVoiceEvents((s) => s.reactions);
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-live="polite"
    >
      {reactions.map((reaction) => (
        <span
          key={reaction.id}
          className="voice-reaction absolute bottom-20 flex -translate-x-1/2 flex-col items-center gap-0.5"
          style={{ left: `${reaction.x}%` }}
        >
          <span className="text-4xl drop-shadow-md" aria-hidden>
            {reaction.emoji}
          </span>
          <span className="bg-background/80 text-foreground max-w-28 truncate rounded-full px-1.5 py-px text-[11px] font-medium backdrop-blur-sm">
            <span className="sr-only">{reaction.emoji} dari </span>
            {reaction.name}
          </span>
        </span>
      ))}
    </div>
  );
}

/** Tombol + popover pemilih reaksi; tetap terbuka supaya bisa kirim beruntun. */
export function VoiceReactionPicker() {
  const room = useRoomContext();
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label="Kirim reaksi"
        title="Kirim reaksi"
        className={controlButtonClassName({ active: open })}
      >
        <Smile aria-hidden />
      </PopoverTrigger>
      <PopoverContent side="top" align="center" className="w-auto flex-row gap-0.5 p-1.5">
        {VOICE_REACTION_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            aria-label={`Reaksi ${emoji}`}
            onClick={() => void sendVoiceEvent(room, { t: "react", emoji })}
            className="hover:bg-muted focus-visible:ring-ring inline-flex size-9 items-center justify-center rounded-md text-xl transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:outline-none active:scale-90"
          >
            {emoji}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
