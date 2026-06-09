import { getRoomMemberContextOrThrow } from "@/lib/ensure-room-studio";
import { prisma } from "@/lib/prisma";
import {
  countRoomChatChannelMessages,
  loadRoomChatMessagesForChannel,
} from "@/lib/room-chat-message-view";
import {
  listRoomChannelsForUser,
  markRoomChannelRead,
  resolveRoomChannelId,
} from "@/lib/room-channels";
import { isRoomHubManagerRole } from "@/lib/room-access";
import { RoomChannelChat } from "./room-channel-chat";

type PageProps = {
  params: Promise<{ roomId: string }>;
  searchParams: Promise<{ channel?: string }>;
};

export default async function RoomChatPage({ params, searchParams }: PageProps) {
  const { roomId } = await params;
  const { channel: channelParam } = await searchParams;
  const { viewerUserId, role } = await getRoomMemberContextOrThrow(roomId);
  const canManage = isRoomHubManagerRole(role);

  const activeChannelId = await resolveRoomChannelId(roomId, channelParam);

  const [channels, messages, totalMessages, mentionableUsers] = await Promise.all([
    listRoomChannelsForUser(roomId, viewerUserId),
    loadRoomChatMessagesForChannel(activeChannelId),
    countRoomChatChannelMessages(activeChannelId),
    prisma.roomMember.findMany({
      where: { roomId },
      select: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: [{ user: { name: "asc" } }, { user: { email: "asc" } }],
    }),
  ]);

  await markRoomChannelRead(activeChannelId, viewerUserId);

  const hasMoreHistory = totalMessages > messages.length;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <RoomChannelChat
        roomId={roomId}
        currentUserId={viewerUserId}
        canManage={canManage}
        initialChannels={channels}
        initialChannelId={activeChannelId}
        initialMessages={messages}
        mentionableUsers={mentionableUsers.map((m) => m.user)}
        memberCount={mentionableUsers.length}
        totalMessages={totalMessages}
        loadedMessages={messages.length}
        hasMoreHistory={hasMoreHistory}
      />
    </div>
  );
}
