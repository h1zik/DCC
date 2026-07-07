"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { DirectChatExperience } from "@/components/direct-chat/direct-chat-experience";
import type { DirectInboxItem } from "@/lib/direct-chat-inbox";

type EligibleUser = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  lastSeenAt: string | null;
};

function MessagesPageContent({
  currentUserId,
  inbox,
  eligibleUsers,
  totalUnread,
}: {
  currentUserId: string;
  inbox: DirectInboxItem[];
  eligibleUsers: EligibleUser[];
  totalUnread: number;
}) {
  const activeId = useSearchParams().get("c");
  const inThread = Boolean(activeId);

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
      {!inThread ? (
        <header className="border-border/70 bg-card/85 mb-2 flex shrink-0 items-center gap-3 rounded-xl border px-3 py-2.5 shadow-sm backdrop-blur-sm">
          <span className="border-primary/25 bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl border shadow-inner">
            <MessageCircle className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-foreground text-base font-semibold tracking-tight">
              Pesan pribadi
            </h1>
            <p className="text-muted-foreground truncate text-xs">
              {totalUnread > 0
                ? `${totalUnread} pesan belum dibaca`
                : "Pilih percakapan atau mulai chat baru"}
            </p>
          </div>
          {totalUnread > 0 ? (
            <span className="bg-primary/10 text-primary rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums">
              {totalUnread > 99 ? "99+" : totalUnread}
            </span>
          ) : null}
        </header>
      ) : null}

      <DirectChatExperience
        className="min-h-0 flex-1"
        currentUserId={currentUserId}
        initialInbox={inbox}
        eligibleUsers={eligibleUsers}
      />
    </div>
  );
}

export function MessagesPageClient(props: {
  currentUserId: string;
  inbox: DirectInboxItem[];
  eligibleUsers: EligibleUser[];
  totalUnread: number;
}) {
  return (
    <Suspense
      fallback={
        <div className="text-muted-foreground border-border bg-card flex h-full min-h-[320px] items-center justify-center rounded-none border text-sm">
          Memuat pesan…
        </div>
      }
    >
      <MessagesPageContent {...props} />
    </Suspense>
  );
}
