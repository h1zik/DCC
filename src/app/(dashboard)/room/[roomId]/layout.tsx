import { RoomHubNav } from "./room-hub-nav";
import { getRoomMemberContextOrThrow } from "@/lib/ensure-room-studio";
import { isSimpleTeamOrHqRoom } from "@/lib/room-simple-hub";

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ roomId: string }>;
};

export default async function RoomHubLayout({ children, params }: LayoutProps) {
  const { roomId } = await params;
  const { room } = await getRoomMemberContextOrThrow(roomId);
  const simpleHub = isSimpleTeamOrHqRoom(room);

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-1 pb-8 sm:px-0">
      <RoomHubNav roomId={roomId} roomName={room.name} simpleHub={simpleHub} />
      {children}
    </div>
  );
}
