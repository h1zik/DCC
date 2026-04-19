import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { getRoomMemberContextOrThrow } from "@/lib/ensure-room-studio";
import { RoomChatForm } from "./room-chat-form";
import { ScrollArea } from "@/components/ui/scroll-area";

type PageProps = { params: Promise<{ roomId: string }> };

function authorInitial(name: string | null, email: string) {
  const s = (name?.trim() || email).trim();
  return s.slice(0, 1).toUpperCase() || "?";
}

export default async function RoomChatPage({ params }: PageProps) {
  const { roomId } = await params;
  await getRoomMemberContextOrThrow(roomId);

  const messages = await prisma.roomMessage.findMany({
    where: { roomId },
    orderBy: { createdAt: "asc" },
    include: {
      author: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        Obrolan grup untuk koordinasi cepat di dalam ruangan ini. Riwayat tersimpan
        di server.
      </p>
      <ScrollArea className="border-border h-[min(420px,50vh)] rounded-xl border p-3">
        <ul className="flex flex-col gap-3 pr-2">
          {messages.length === 0 ? (
            <li className="text-muted-foreground text-sm">
              Belum ada pesan. Mulai percakapan di bawah.
            </li>
          ) : (
            messages.map((m) => (
              <li
                key={m.id}
                className="bg-muted/40 rounded-lg border border-border px-3 py-2 text-sm"
              >
                <div className="flex gap-3">
                  <div className="shrink-0 pt-0.5">
                    {m.author.image ? (
                      <Image
                        src={m.author.image}
                        alt=""
                        width={36}
                        height={36}
                        className="border-border size-9 rounded-full border object-cover"
                        unoptimized
                      />
                    ) : (
                      <div
                        className="border-border bg-accent/40 text-accent-foreground flex size-9 items-center justify-center rounded-full border text-xs font-semibold"
                        aria-hidden
                      >
                        {authorInitial(m.author.name, m.author.email)}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-muted-foreground flex flex-wrap items-baseline justify-between gap-2 text-xs">
                      <span className="font-medium text-foreground">
                        {m.author.name ?? m.author.email}
                      </span>
                      <time dateTime={m.createdAt.toISOString()}>
                        {m.createdAt.toLocaleString("id-ID", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </time>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </ScrollArea>
      <RoomChatForm roomId={roomId} />
    </div>
  );
}
