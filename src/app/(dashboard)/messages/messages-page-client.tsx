"use client";

import { Suspense } from "react";
import { DirectChatExperience } from "@/components/direct-chat/direct-chat-experience";
import type { DirectInboxItem } from "@/lib/direct-chat-inbox";

type EligibleUser = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  lastSeenAt: string | null;
};

/** `useSearchParams` di dalam `DirectChatExperience` butuh batas Suspense. */
export function MessagesPageClient(props: {
  currentUserId: string;
  inbox: DirectInboxItem[];
  eligibleUsers: EligibleUser[];
}) {
  return (
    <Suspense
      fallback={
        <div className="text-muted-foreground border-border bg-card flex h-full min-h-[320px] items-center justify-center rounded-xl border text-sm">
          Memuat pesan…
        </div>
      }
    >
      <DirectChatExperience
        className="min-h-0 flex-1"
        currentUserId={props.currentUserId}
        initialInbox={props.inbox}
        eligibleUsers={props.eligibleUsers}
      />
    </Suspense>
  );
}
