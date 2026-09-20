import { requireDirectChatSession } from "@/lib/direct-chat-access";
import { listDirectChatEligibleUsers } from "@/lib/direct-chat-access";
import { loadDirectChatInbox } from "@/lib/direct-chat-inbox";
import { MessagesPageClient } from "@/app/(dashboard)/messages/messages-page-client";

export default async function MessagesPage() {
  const session = await requireDirectChatSession();
  const [inbox, eligibleUsers] = await Promise.all([
    loadDirectChatInbox(session.user.id),
    listDirectChatEligibleUsers(session.user.id),
  ]);

  return (
    <MessagesPageClient
      currentUserId={session.user.id}
      inbox={inbox}
      eligibleUsers={eligibleUsers.map((u) => ({
        ...u,
        lastSeenAt: u.lastSeenAt?.toISOString() ?? null,
      }))}
    />
  );
}
