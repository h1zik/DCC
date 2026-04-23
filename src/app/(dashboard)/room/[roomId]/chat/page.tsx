import { getRoomMemberContextOrThrow } from "@/lib/ensure-room-studio";
import { loadRoomChatMessagesForRoom } from "@/lib/room-chat-message-view";
import { RoomChatExperience } from "./room-chat-experience";

type PageProps = { params: Promise<{ roomId: string }> };

export default async function RoomChatPage({ params }: PageProps) {
  const { roomId } = await params;
  const { viewerUserId } = await getRoomMemberContextOrThrow(roomId);

  const messages = await loadRoomChatMessagesForRoom(roomId);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        Obrolan grup ala Discord ringkas: balas dengan kutipan, sisipkan emoji
        dari panel, dan lampirkan GIF (pencarian Giphy jika{" "}
        <code className="text-foreground">GIPHY_API_KEY</code> diatur, atau tempel
        URL Giphy/Tenor). Riwayat tersimpan di server.
      </p>
      <RoomChatExperience
        key={roomId}
        roomId={roomId}
        currentUserId={viewerUserId}
        messages={messages}
      />
    </div>
  );
}
