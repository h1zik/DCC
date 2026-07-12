"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
  CalendarDays,
  MoreHorizontal,
  Pencil,
  Plus,
  SquareKanban,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  createPersonalColumn,
  deletePersonalCard,
  deletePersonalColumn,
  movePersonalCard,
  togglePersonalCardDone,
  updatePersonalColumn,
  upsertPersonalCard,
} from "@/actions/personal-kanban";
import { actionErrorMessage } from "@/lib/action-error-message";
import { KanbanColumnColorField } from "@/components/tasks/kanban-column-color-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type CardItem = {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  isDone: boolean;
};

type ColumnItem = {
  id: string;
  title: string;
  colorHex: string | null;
  cards: CardItem[];
};

const DEFAULT_COLUMN_COLOR = "#94A3B8";

function CardView({
  card,
  now,
  dragging,
}: {
  card: CardItem;
  now: Date;
  dragging?: boolean;
}) {
  const due = card.dueDate ? new Date(card.dueDate) : null;
  const overdue = due !== null && !card.isDone && due.getTime() < now.getTime();
  return (
    <div
      className={cn(
        "bg-card rounded-lg border p-2.5 text-sm shadow-sm",
        dragging && "opacity-90 shadow-md",
      )}
    >
      <p
        className={cn(
          "font-medium leading-snug",
          card.isDone && "text-muted-foreground line-through",
        )}
      >
        {card.title}
      </p>
      {card.description ? (
        <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
          {card.description}
        </p>
      ) : null}
      {due ? (
        <p
          className={cn(
            "mt-1.5 inline-flex items-center gap-1 text-[11px]",
            overdue ? "text-destructive font-medium" : "text-muted-foreground",
          )}
        >
          <CalendarDays className="size-3" aria-hidden />
          {format(due, "d MMM yyyy", { locale: localeId })}
        </p>
      ) : null}
    </div>
  );
}

function SortableCard({
  card,
  now,
  onOpen,
}: {
  card: CardItem;
  now: Date;
  onOpen: (card: CardItem) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id, data: { type: "card" } });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("cursor-grab touch-none", isDragging && "opacity-40")}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(card)}
    >
      <CardView card={card} now={now} />
    </div>
  );
}

function BoardColumn({
  column,
  now,
  onOpenCard,
  onAddCard,
  onEditColumn,
  onDeleteColumn,
}: {
  column: ColumnItem;
  now: Date;
  onOpenCard: (card: CardItem) => void;
  onAddCard: (columnId: string) => void;
  onEditColumn: (column: ColumnItem) => void;
  onDeleteColumn: (column: ColumnItem) => void;
}) {
  const { setNodeRef } = useDroppable({
    id: column.id,
    data: { type: "column" },
  });
  const accent = column.colorHex || DEFAULT_COLUMN_COLOR;
  return (
    <section className="bg-muted/40 flex w-72 shrink-0 flex-col rounded-xl border">
      <header className="flex items-center gap-2 px-3 py-2.5">
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: accent }}
          aria-hidden
        />
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">
          {column.title}
        </h2>
        <span className="text-muted-foreground text-xs tabular-nums">
          {column.cards.length}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger
            type="button"
            aria-label={`Menu kolom ${column.title}`}
            className="text-muted-foreground hover:bg-accent hover:text-foreground inline-flex size-7 shrink-0 items-center justify-center rounded-md transition-colors"
          >
            <MoreHorizontal className="size-4" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEditColumn(column)}>
              <Pencil className="size-3.5" aria-hidden />
              Ubah kolom
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => onDeleteColumn(column)}
            >
              <Trash2 className="size-3.5" aria-hidden />
              Hapus kolom
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      <SortableContext
        items={column.cards.map((c) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <div
          ref={setNodeRef}
          className="flex min-h-16 flex-1 flex-col gap-2 px-2.5 pb-2"
        >
          {column.cards.map((card) => (
            <SortableCard key={card.id} card={card} now={now} onOpen={onOpenCard} />
          ))}
        </div>
      </SortableContext>
      <footer className="px-2.5 pb-2.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground w-full justify-start gap-1.5"
          onClick={() => onAddCard(column.id)}
        >
          <Plus className="size-3.5" aria-hidden />
          Tambah kartu
        </Button>
      </footer>
    </section>
  );
}

export function KanbanClient({ columns }: { columns: ColumnItem[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  // Acuan "sekarang" stabil per-mount untuk penanda tenggat lewat (pola tasks-gantt).
  const [now] = useState(() => new Date());
  // Salinan lokal untuk drag optimistik; disinkronkan ulang dari props.
  const [board, setBoard] = useState(columns);
  const [boardKey, setBoardKey] = useState(columns);
  if (boardKey !== columns) {
    setBoardKey(columns);
    setBoard(columns);
  }

  const [activeCard, setActiveCard] = useState<CardItem | null>(null);
  const [cardDialog, setCardDialog] = useState<{
    editing: CardItem | null;
    columnId: string;
  } | null>(null);
  const [cardForm, setCardForm] = useState({
    title: "",
    description: "",
    dueDate: "",
    isDone: false,
  });
  const [columnDialog, setColumnDialog] = useState<ColumnItem | "new" | null>(
    null,
  );
  const [columnForm, setColumnForm] = useState({
    title: "",
    colorHex: DEFAULT_COLUMN_COLOR,
  });
  const [pending, startPending] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const cardIndex = useMemo(() => {
    const map = new Map<string, { columnId: string; card: CardItem }>();
    for (const col of board) {
      for (const card of col.cards) map.set(card.id, { columnId: col.id, card });
    }
    return map;
  }, [board]);

  function findColumnOf(id: string): string | null {
    if (board.some((c) => c.id === id)) return id;
    return cardIndex.get(id)?.columnId ?? null;
  }

  function onDragStart(e: DragStartEvent) {
    const entry = cardIndex.get(String(e.active.id));
    setActiveCard(entry?.card ?? null);
  }

  function onDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over) return;
    const activeId = String(active.id);
    const fromCol = findColumnOf(activeId);
    const toCol = findColumnOf(String(over.id));
    if (!fromCol || !toCol || fromCol === toCol) return;
    // Pindahkan kartu antar kolom secara optimistik saat masih di-drag.
    setBoard((prev) => {
      const from = prev.find((c) => c.id === fromCol);
      const card = from?.cards.find((c) => c.id === activeId);
      if (!from || !card) return prev;
      return prev.map((c) => {
        if (c.id === fromCol) {
          return { ...c, cards: c.cards.filter((x) => x.id !== activeId) };
        }
        if (c.id === toCol) {
          const overIdx = c.cards.findIndex((x) => x.id === String(over.id));
          const cards = [...c.cards];
          cards.splice(overIdx < 0 ? cards.length : overIdx, 0, card);
          return { ...c, cards };
        }
        return c;
      });
    });
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveCard(null);
    if (!over) return;
    const activeId = String(active.id);
    const toCol = findColumnOf(String(over.id));
    if (!toCol) return;

    let nextBoard = board;
    const col = board.find((c) => c.id === toCol);
    if (col) {
      const oldIdx = col.cards.findIndex((c) => c.id === activeId);
      const overIdx = col.cards.findIndex((c) => c.id === String(over.id));
      if (oldIdx >= 0 && overIdx >= 0 && oldIdx !== overIdx) {
        nextBoard = board.map((c) =>
          c.id === toCol
            ? { ...c, cards: arrayMove(c.cards, oldIdx, overIdx) }
            : c,
        );
        setBoard(nextBoard);
      }
    }

    const finalCol = nextBoard.find((c) => c.id === toCol);
    if (!finalCol || !finalCol.cards.some((c) => c.id === activeId)) return;
    startTransition(async () => {
      try {
        await movePersonalCard({
          cardId: activeId,
          toColumnId: toCol,
          orderedCardIds: finalCol.cards.map((c) => c.id),
        });
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal memindahkan kartu."));
        router.refresh();
      }
    });
  }

  function openCreateCard(columnId: string) {
    setCardForm({ title: "", description: "", dueDate: "", isDone: false });
    setCardDialog({ editing: null, columnId });
  }

  function openEditCard(card: CardItem) {
    setCardForm({
      title: card.title,
      description: card.description ?? "",
      dueDate: card.dueDate ? card.dueDate.slice(0, 10) : "",
      isDone: card.isDone,
    });
    setCardDialog({ editing: card, columnId: "" });
  }

  function submitCard(e: React.FormEvent) {
    e.preventDefault();
    if (!cardDialog) return;
    if (!cardForm.title.trim()) {
      toast.error("Judul kartu wajib diisi.");
      return;
    }
    startPending(async () => {
      try {
        await upsertPersonalCard({
          id: cardDialog.editing?.id,
          columnId: cardDialog.editing ? undefined : cardDialog.columnId,
          title: cardForm.title.trim(),
          description: cardForm.description.trim() || null,
          dueDate: cardForm.dueDate || null,
          isDone: cardForm.isDone,
        });
        toast.success(
          cardDialog.editing ? "Kartu diperbarui." : "Kartu ditambahkan.",
        );
        setCardDialog(null);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menyimpan kartu."));
      }
    });
  }

  function onDeleteCard() {
    const card = cardDialog?.editing;
    if (!card) return;
    if (!confirm(`Hapus kartu “${card.title}”?`)) return;
    startPending(async () => {
      try {
        await deletePersonalCard(card.id);
        toast.success("Kartu dihapus.");
        setCardDialog(null);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menghapus kartu."));
      }
    });
  }

  function onToggleDone(checked: boolean) {
    setCardForm((s) => ({ ...s, isDone: checked }));
    const card = cardDialog?.editing;
    if (!card) return;
    startTransition(async () => {
      try {
        await togglePersonalCardDone(card.id, checked);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal memperbarui status."));
      }
    });
  }

  function openCreateColumn() {
    setColumnForm({ title: "", colorHex: DEFAULT_COLUMN_COLOR });
    setColumnDialog("new");
  }

  function openEditColumn(column: ColumnItem) {
    setColumnForm({
      title: column.title,
      colorHex: column.colorHex || DEFAULT_COLUMN_COLOR,
    });
    setColumnDialog(column);
  }

  function submitColumn(e: React.FormEvent) {
    e.preventDefault();
    if (!columnForm.title.trim()) {
      toast.error("Judul kolom wajib diisi.");
      return;
    }
    startPending(async () => {
      try {
        if (columnDialog === "new") {
          await createPersonalColumn({
            title: columnForm.title.trim(),
            colorHex: columnForm.colorHex,
          });
          toast.success("Kolom ditambahkan.");
        } else if (columnDialog) {
          await updatePersonalColumn({
            id: columnDialog.id,
            title: columnForm.title.trim(),
            colorHex: columnForm.colorHex,
          });
          toast.success("Kolom diperbarui.");
        }
        setColumnDialog(null);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menyimpan kolom."));
      }
    });
  }

  function onDeleteColumn(column: ColumnItem) {
    const suffix =
      column.cards.length > 0
        ? ` beserta ${column.cards.length} kartunya`
        : "";
    if (!confirm(`Hapus kolom “${column.title}”${suffix}?`)) return;
    startPending(async () => {
      try {
        await deletePersonalColumn(column.id);
        toast.success("Kolom dihapus.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menghapus kolom."));
      }
    });
  }

  const totalCards = board.reduce((n, c) => n + c.cards.length, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          {totalCards} kartu di {board.length} kolom
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={openCreateColumn}
          className="gap-1.5"
        >
          <Plus className="size-3.5" aria-hidden />
          Tambah kolom
        </Button>
      </div>

      {board.length === 0 ? (
        <div className="bg-card text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
          <SquareKanban
            className="text-muted-foreground/50 mx-auto mb-3 size-8"
            aria-hidden
          />
          Belum ada kolom. Tambahkan kolom pertama untuk mulai mengatur tugas.
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
        >
          <div className="flex items-start gap-3 overflow-x-auto pb-2">
            {board.map((column) => (
              <BoardColumn
                key={column.id}
                column={column}
                now={now}
                onOpenCard={openEditCard}
                onAddCard={openCreateCard}
                onEditColumn={openEditColumn}
                onDeleteColumn={onDeleteColumn}
              />
            ))}
          </div>
          <DragOverlay>
            {activeCard ? <CardView card={activeCard} now={now} dragging /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Dialog kartu */}
      <Dialog
        open={cardDialog !== null}
        onOpenChange={(open) => !open && setCardDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {cardDialog?.editing ? "Ubah kartu" : "Tambah kartu"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={submitCard} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="card-title">Judul</Label>
              <Input
                id="card-title"
                value={cardForm.title}
                maxLength={200}
                onChange={(e) =>
                  setCardForm((s) => ({ ...s, title: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="card-desc">Deskripsi (opsional)</Label>
              <Textarea
                id="card-desc"
                value={cardForm.description}
                rows={3}
                maxLength={5000}
                onChange={(e) =>
                  setCardForm((s) => ({ ...s, description: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="card-due">Tenggat (opsional)</Label>
              <Input
                id="card-due"
                type="date"
                value={cardForm.dueDate}
                onChange={(e) =>
                  setCardForm((s) => ({ ...s, dueDate: e.target.value }))
                }
              />
            </div>
            {cardDialog?.editing ? (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={cardForm.isDone}
                  onCheckedChange={(v) => onToggleDone(v === true)}
                />
                Selesai
              </label>
            ) : null}
            <DialogFooter className="gap-2">
              {cardDialog?.editing ? (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={pending}
                  onClick={onDeleteCard}
                >
                  Hapus
                </Button>
              ) : null}
              <Button type="submit" disabled={pending}>
                {cardDialog?.editing ? "Simpan perubahan" : "Tambah kartu"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog kolom */}
      <Dialog
        open={columnDialog !== null}
        onOpenChange={(open) => !open && setColumnDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {columnDialog === "new" ? "Tambah kolom" : "Ubah kolom"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={submitColumn} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="col-title">Judul kolom</Label>
              <Input
                id="col-title"
                value={columnForm.title}
                maxLength={80}
                onChange={(e) =>
                  setColumnForm((s) => ({ ...s, title: e.target.value }))
                }
                required
              />
            </div>
            <KanbanColumnColorField
              value={columnForm.colorHex}
              onChange={(hex) => setColumnForm((s) => ({ ...s, colorHex: hex }))}
              disabled={pending}
            />
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {columnDialog === "new" ? "Tambah kolom" : "Simpan perubahan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
