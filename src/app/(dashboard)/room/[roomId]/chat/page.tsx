import { Info, MessageCircle } from "lucide-react";
import { getRoomMemberContextOrThrow } from "@/lib/ensure-room-studio";
import { prisma } from "@/lib/prisma";
import {
  countRoomChatMessages,
  loadRoomChatMessagesForRoom,
} from "@/lib/room-chat-message-view";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RoomChatExperience } from "./room-chat-experience";

type PageProps = { params: Promise<{ roomId: string }> };

export default async function RoomChatPage({ params }: PageProps) {
  const { roomId } = await params;
  const { viewerUserId } = await getRoomMemberContextOrThrow(roomId);

  // Hanya muat N pesan terakhir (`ROOM_CHAT_INITIAL_MESSAGE_LIMIT`); polling
  // berikutnya menarik delta via `?since`. Hitungan total dipakai untuk badge.
  const [messages, totalMessages, mentionableUsers] = await Promise.all([
    loadRoomChatMessagesForRoom(roomId),
    countRoomChatMessages(roomId),
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

  const hasMoreHistory = totalMessages > messages.length;

  return (
    <div className="flex flex-col gap-4">
      <header className="border-border bg-card relative isolate overflow-hidden rounded-2xl border shadow-sm">
        <div
          className="bg-gradient-to-br from-primary/10 via-primary/5 absolute inset-0 to-transparent"
          aria-hidden
        />
        <div
          className="bg-gradient-to-r from-transparent via-primary/40 to-transparent absolute inset-x-0 top-0 h-px"
          aria-hidden
        />
        <div className="relative flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className="border-primary/30 bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl border"
              aria-hidden
            >
              <MessageCircle className="size-5" />
            </span>
            <div className="min-w-0 space-y-1">
              <h2 className="text-foreground text-base font-semibold tracking-tight sm:text-lg">
                Grup chat ruangan
              </h2>
              <p className="text-muted-foreground text-pretty text-sm leading-relaxed">
                Obrolan singkat dan koordinasi cepat antar anggota ruangan.
                Riwayat pesan tersimpan di server.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 self-start">
            <span className="border-border bg-background text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium shadow-sm">
              <span className="text-foreground font-semibold tabular-nums">
                {mentionableUsers.length}
              </span>
              anggota
            </span>
            <span
              className="border-border bg-background text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium shadow-sm"
              title={
                hasMoreHistory
                  ? `Menampilkan ${messages.length} dari ${totalMessages} pesan terbaru`
                  : `${totalMessages} pesan total`
              }
            >
              <span className="text-foreground font-semibold tabular-nums">
                {totalMessages}
              </span>
              pesan
              {hasMoreHistory ? (
                <span className="text-muted-foreground/80 text-[10px]">
                  · {messages.length} terbaru
                </span>
              ) : null}
            </span>
            <Popover>
              <PopoverTrigger
                render={
                  <Button type="button" variant="outline" size="sm">
                    <Info className="size-3.5" aria-hidden />
                    Tips
                  </Button>
                }
              />
              <PopoverContent className="text-muted-foreground w-72 space-y-2 text-xs leading-relaxed">
                <p className="text-foreground font-semibold">Cara pakai chat</p>
                <ul className="ml-4 list-disc space-y-1">
                  <li>
                    Mention anggota dengan <code className="text-foreground">@</code>{" "}
                    untuk notifikasi.
                  </li>
                  <li>Sisipkan emoji dari panel di kotak input.</li>
                  <li>Balas dengan kutipan untuk konteks pesan.</li>
                  <li>
                    Lampirkan GIF: pencarian Giphy bila{" "}
                    <code className="text-foreground">GIPHY_API_KEY</code> diatur,
                    atau tempel URL Giphy/Tenor.
                  </li>
                </ul>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </header>
      <RoomChatExperience
        key={roomId}
        roomId={roomId}
        currentUserId={viewerUserId}
        messages={messages}
        mentionableUsers={mentionableUsers.map((m) => m.user)}
      />
    </div>
  );
}
