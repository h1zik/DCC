"use client";

import Link from "next/link";
import { memo } from "react";
import { ArrowLeft, Files, Search } from "lucide-react";
import type { DirectInboxItem } from "@/lib/direct-chat-inbox";
import {
  directChatAuthorLabel,
  formatDirectChatPresence,
  isDirectChatUserOnline,
} from "@/lib/direct-chat-format";
import { DirectChatAvatar } from "@/components/direct-chat/direct-chat-avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const DirectChatThreadHeader = memo(function DirectChatThreadHeader({
  peer,
  searchOpen,
  archiveOpen,
  onBack,
  onToggleSearch,
  onToggleArchive,
}: {
  peer: DirectInboxItem["otherUser"];
  searchOpen: boolean;
  archiveOpen: boolean;
  onBack: () => void;
  onToggleSearch: () => void;
  onToggleArchive: () => void;
}) {
  const online = isDirectChatUserOnline(peer.lastSeenAt);
  return (
    <header className="border-border/70 bg-card z-10 flex shrink-0 items-center gap-1 border-b px-2 py-2.5 sm:px-4">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label="Kembali ke daftar percakapan"
        onClick={onBack}
      >
        <ArrowLeft className="size-4" />
      </Button>
      <Link
        href={`/profile/${peer.id}`}
        className="focus-visible:ring-ring/50 -my-1 mr-auto flex min-w-0 items-center gap-3 rounded-lg py-1 pr-2 outline-none focus-visible:ring-3"
        title="Buka profil"
      >
        <DirectChatAvatar
          name={peer.name}
          email={peer.email}
          image={peer.image}
          size={40}
          online={online}
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {directChatAuthorLabel(peer.name, peer.email)}
          </p>
          <p
            className={cn(
              "truncate text-xs",
              online
                ? "font-medium text-emerald-600 dark:text-emerald-400"
                : "text-muted-foreground",
            )}
          >
            {formatDirectChatPresence(peer.lastSeenAt)}
          </p>
        </div>
      </Link>
      <Button
        type="button"
        variant={searchOpen ? "secondary" : "ghost"}
        size="icon"
        aria-pressed={searchOpen}
        aria-label="Cari di percakapan"
        title="Cari di percakapan (Ctrl+F)"
        onClick={onToggleSearch}
      >
        <Search className="size-4" />
      </Button>
      <Button
        type="button"
        variant={archiveOpen ? "secondary" : "ghost"}
        size="icon"
        aria-pressed={archiveOpen}
        aria-label="Media, file, dan tautan"
        title="Media, file, dan tautan"
        onClick={onToggleArchive}
      >
        <Files className="size-4" />
      </Button>
    </header>
  );
});
