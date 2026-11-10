import { redirect } from "next/navigation";
import { getRoomMemberContextOrThrow } from "@/lib/ensure-room-studio";
import { isSimpleTeamOrHqRoom } from "@/lib/room-simple-hub";
import { ContentPlanningClient } from "./content-planning-client";
import { loadContentPlanData } from "./content-plan-data";

type PageProps = { params: Promise<{ roomId: string }> };

export default async function RoomContentPlanningPage({ params }: PageProps) {
  const { roomId } = await params;
  const { room } = await getRoomMemberContextOrThrow(roomId);
  if (isSimpleTeamOrHqRoom(room)) {
    redirect(`/room/${roomId}/tasks`);
  }

  const data = await loadContentPlanData(roomId, null, room);

  return <ContentPlanningClient roomId={roomId} viewId={null} {...data} />;
}
