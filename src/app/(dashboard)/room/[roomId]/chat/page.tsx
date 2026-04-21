import { prisma } from "@/lib/prisma";
import { getRoomMemberContextOrThrow } from "@/lib/ensure-room-studio";
import {
  RoomChatExperience,
  type RoomChatMessageView,
} from "./room-chat-experience";

type PageProps = { params: Promise<{ roomId: string }> };

export default async function RoomChatPage({ params }: PageProps) {
  const { roomId } = await params;
  const { viewerUserId } = await getRoomMemberContextOrThrow(roomId);

  const rows = await prisma.roomMessage.findMany({
    where: { roomId },
    orderBy: { createdAt: "asc" },
    include: {
      author: { select: { id: true, name: true, email: true, image: true } },
      replyTo: {
        select: {
          id: true,
          body: true,
          gifUrl: true,
          author: { select: { name: true, email: true } },
        },
      },
    },
  });

  const messages: RoomChatMessageView[] = rows.map((m) => ({
    id: m.id,
    body: m.body,
    gifUrl: m.gifUrl,
    replyToId: m.replyToId,
    createdAt: m.createdAt.toISOString(),
    author: m.author,
    replyTo: m.replyTo
      ? {
          id: m.replyTo.id,
          body: m.replyTo.body,
          gifUrl: m.replyTo.gifUrl,
          author: m.replyTo.author,
        }
      : null,
  }));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        Obrolan grup ala Discord ringkas: balas dengan kutipan, sisipkan emoji
        dari panel, dan lampirkan GIF (pencarian Giphy jika{" "}
        <code className="text-foreground">GIPHY_API_KEY</code> diatur, atau tempel
        URL Giphy/Tenor). Riwayat tersimpan di server.
      </p>
      <RoomChatExperience
        roomId={roomId}
        currentUserId={viewerUserId}
        messages={messages}
      />
    </div>
  );
}
