import { redirect } from "next/navigation";

type PageProps = { params: Promise<{ roomId: string }> };

/** URL lama — hub ruangan sekarang di /room/[roomId]/… */
export default async function LegacyTasksRoomRedirect({ params }: PageProps) {
  const { roomId } = await params;
  redirect(`/room/${roomId}/tasks`);
}
