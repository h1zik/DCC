import { redirect } from "next/navigation";

type PageProps = { params: Promise<{ roomId: string }> };

export default async function RoomHubIndex({ params }: PageProps) {
  const { roomId } = await params;
  redirect(`/room/${roomId}/tasks`);
}
