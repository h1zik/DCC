import { prisma } from "@/lib/prisma";
import { requirePersonalOwnerId } from "@/lib/personal-space";
import { KanbanClient } from "./kanban-client";

const DEFAULT_COLUMNS = ["Rencana", "Dikerjakan", "Selesai"] as const;

export default async function PersonalKanbanPage() {
  const ownerId = await requirePersonalOwnerId();

  // Seed kolom default sekali saat papan masih kosong.
  const count = await prisma.personalKanbanColumn.count({ where: { ownerId } });
  if (count === 0) {
    await prisma.personalKanbanColumn.createMany({
      data: DEFAULT_COLUMNS.map((title, i) => ({
        ownerId,
        title,
        sortOrder: i,
      })),
    });
  }

  const columns = await prisma.personalKanbanColumn.findMany({
    where: { ownerId },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      title: true,
      colorHex: true,
      cards: {
        orderBy: { sortKey: "asc" },
        select: {
          id: true,
          title: true,
          description: true,
          dueDate: true,
          isDone: true,
        },
      },
    },
  });

  return (
    <KanbanClient
      columns={columns.map((c) => ({
        ...c,
        cards: c.cards.map((card) => ({
          ...card,
          dueDate: card.dueDate ? card.dueDate.toISOString() : null,
        })),
      }))}
    />
  );
}
