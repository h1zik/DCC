"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Grid2x2,
  LayoutTemplate,
  MoreHorizontal,
  PencilLine,
  Plus,
  PresentationIcon,
  Trash2,
} from "lucide-react";
import {
  createRoomWhiteboard,
  deleteRoomWhiteboard,
  duplicateRoomWhiteboard,
  renameRoomWhiteboard,
  setRoomWhiteboardBackground,
} from "@/actions/room-whiteboards";
import { actionErrorMessage } from "@/lib/action-error-message";
import type { SerializedElement } from "@/lib/whiteboard/serialize";
import { WHITEBOARD_BACKGROUNDS } from "@/lib/whiteboard/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { BoardCanvas, type BoardMeta } from "./board-canvas";

/**
 * Kulit luar view Whiteboard: daftar papan di sisi kiri + kanvas aktif.
 *
 * Berpindah papan me-*remount* kanvas lewat `key`, jadi tiap papan selalu
 * mulai dengan state, riwayat undo, dan koneksi realtime yang bersih.
 */

export type WhiteboardListItem = {
  id: string;
  title: string;
  rev: number;
  background: string;
  thumbnail: string | null;
  updatedAt: string;
  lastEditedByName: string | null;
};

export function WhiteboardViewClient({
  roomId,
  viewId,
  boards,
  activeBoard,
  activeElements,
  currentUser,
}: {
  roomId: string;
  viewId: string;
  boards: WhiteboardListItem[];
  activeBoard: BoardMeta | null;
  activeElements: SerializedElement[];
  currentUser: { id: string; name: string; image: string | null };
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [railOpen, setRailOpen] = useState(true);

  const [selectedId, setSelectedId] = useState<string | null>(
    activeBoard?.id ?? null,
  );
  const [board, setBoard] = useState<BoardMeta | null>(activeBoard);
  const [elements, setElements] = useState<SerializedElement[]>(activeElements);
  const [loadingBoard, setLoadingBoard] = useState(false);

  const [renameTarget, setRenameTarget] = useState<WhiteboardListItem | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<WhiteboardListItem | null>(null);

  // Data papan aktif dari server berubah (mis. setelah rename) — ikuti.
  const activeBoardId = activeBoard?.id ?? null;
  useEffect(() => {
    if (!activeBoardId || activeBoardId !== selectedId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- menyelaraskan salinan lokal dengan data server setelah router.refresh()
    setBoard(activeBoard);
  }, [activeBoard, activeBoardId, selectedId]);

  const openBoard = useCallback(
    async (boardId: string) => {
      if (boardId === selectedId) return;
      setSelectedId(boardId);
      setLoadingBoard(true);
      try {
        const res = await fetch(
          `/api/rooms/${roomId}/whiteboards/${boardId}/sync`,
          { cache: "no-store" },
        );
        if (!res.ok) throw new Error("Papan gagal dimuat.");
        const data = (await res.json()) as {
          board: { id: string; title: string; rev: number; background: string };
          elements: SerializedElement[];
        };
        setBoard(data.board);
        setElements(data.elements);
      } catch (error) {
        toast.error(actionErrorMessage(error, "Papan gagal dimuat."));
        setSelectedId(board?.id ?? null);
      } finally {
        setLoadingBoard(false);
      }
    },
    [roomId, selectedId, board?.id],
  );

  const handleCreate = useCallback(() => {
    setPending(true);
    void (async () => {
      try {
        const created = await createRoomWhiteboard({ viewId });
        toast.success("Papan baru dibuat.");
        setSelectedId(created.id);
        setBoard(null);
        setElements([]);
        router.refresh();
        await openBoard(created.id);
      } catch (error) {
        toast.error(actionErrorMessage(error, "Gagal membuat papan."));
      } finally {
        setPending(false);
      }
    })();
  }, [viewId, router, openBoard]);

  const handleDuplicate = useCallback(
    (boardId: string) => {
      setPending(true);
      void (async () => {
        try {
          const created = await duplicateRoomWhiteboard({ boardId });
          toast.success("Papan diduplikasi.");
          router.refresh();
          await openBoard(created.id);
        } catch (error) {
          toast.error(actionErrorMessage(error, "Gagal menduplikasi papan."));
        } finally {
          setPending(false);
        }
      })();
    },
    [router, openBoard],
  );

  const handleRename = useCallback(() => {
    const target = renameTarget;
    const title = renameValue.trim();
    if (!target || !title) return;
    setPending(true);
    void (async () => {
      try {
        await renameRoomWhiteboard({ boardId: target.id, title });
        setBoard((prev) =>
          prev && prev.id === target.id ? { ...prev, title } : prev,
        );
        setRenameTarget(null);
        toast.success("Nama papan diperbarui.");
        router.refresh();
      } catch (error) {
        toast.error(actionErrorMessage(error, "Gagal mengubah nama papan."));
      } finally {
        setPending(false);
      }
    })();
  }, [renameTarget, renameValue, router]);

  const handleDelete = useCallback(() => {
    const target = deleteTarget;
    if (!target) return;
    setPending(true);
    void (async () => {
      try {
        await deleteRoomWhiteboard({ boardId: target.id });
        setDeleteTarget(null);
        toast.success("Papan dihapus.");
        if (target.id === selectedId) {
          const fallback = boards.find((b) => b.id !== target.id);
          if (fallback) {
            setSelectedId(null);
            await openBoard(fallback.id);
          } else {
            setSelectedId(null);
            setBoard(null);
            setElements([]);
          }
        }
        router.refresh();
      } catch (error) {
        toast.error(actionErrorMessage(error, "Gagal menghapus papan."));
      } finally {
        setPending(false);
      }
    })();
  }, [deleteTarget, selectedId, boards, router, openBoard]);

  const handleBackground = useCallback(
    (background: string) => {
      if (!board) return;
      setBoard({ ...board, background });
      void setRoomWhiteboardBackground({ boardId: board.id, background }).catch(
        (error: unknown) => {
          toast.error(actionErrorMessage(error, "Gagal mengubah latar papan."));
        },
      );
    },
    [board],
  );

  const boardList = useMemo(() => {
    // Papan yang baru dibuat mungkin belum ada di props hasil server render.
    if (!board || boards.some((b) => b.id === board.id)) return boards;
    return [
      ...boards,
      {
        id: board.id,
        title: board.title,
        rev: board.rev,
        background: board.background,
        thumbnail: null,
        updatedAt: new Date().toISOString(),
        lastEditedByName: null,
      },
    ];
  }, [boards, board]);

  return (
    <div
      data-whiteboard-shell
      className="border-border bg-card flex min-h-0 flex-1 overflow-hidden rounded-xl border"
    >
      {/* Rail daftar papan */}
      <aside
        className={cn(
          "border-border bg-muted/30 flex shrink-0 flex-col border-r transition-[width] duration-200",
          railOpen ? "w-56" : "w-11",
        )}
      >
        <div className="border-border flex items-center gap-1 border-b px-2 py-2">
          {railOpen ? (
            <>
              <LayoutTemplate
                className="text-muted-foreground size-3.5 shrink-0"
                aria-hidden
              />
              <span className="text-muted-foreground flex-1 truncate text-[11px] font-semibold tracking-wide uppercase">
                Papan ({boardList.length})
              </span>
            </>
          ) : null}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-7 shrink-0"
                  onClick={() => setRailOpen((open) => !open)}
                  aria-label={railOpen ? "Sembunyikan daftar" : "Tampilkan daftar"}
                >
                  {railOpen ? (
                    <ChevronLeft className="size-3.5" aria-hidden />
                  ) : (
                    <ChevronRight className="size-3.5" aria-hidden />
                  )}
                </Button>
              }
            />
            <TooltipContent side="right">
              {railOpen ? "Sembunyikan daftar papan" : "Tampilkan daftar papan"}
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {railOpen ? (
            <ul className="space-y-1.5">
              {boardList.map((item, index) => {
                const active = item.id === selectedId;
                return (
                  <li key={item.id}>
                    <div
                      className={cn(
                        "group border-border bg-card relative overflow-hidden rounded-lg border transition-colors",
                        active
                          ? "border-primary/60 ring-primary/25 ring-2"
                          : "hover:border-primary/40",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => void openBoard(item.id)}
                        className="block w-full text-left"
                      >
                        <span className="bg-muted/60 relative flex h-20 w-full items-center justify-center overflow-hidden">
                          {item.thumbnail ? (
                            <Image
                              src={item.thumbnail}
                              alt=""
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          ) : (
                            <Grid2x2
                              className="text-muted-foreground/40 size-6"
                              aria-hidden
                            />
                          )}
                        </span>
                        <span className="block px-2 py-1.5">
                          <span className="text-foreground block truncate text-xs font-medium">
                            {item.title}
                          </span>
                          <span className="text-muted-foreground block truncate text-[10px]">
                            {item.lastEditedByName
                              ? `Terakhir oleh ${item.lastEditedByName}`
                              : `Papan ${index + 1}`}
                          </span>
                        </span>
                      </button>

                      <div
                        className={cn(
                          "absolute top-1 right-1 transition-opacity group-hover:opacity-100 focus-within:opacity-100",
                          // Papan aktif selalu menampilkan aksinya agar tetap
                          // terjangkau di perangkat sentuh (tidak ada hover).
                          active ? "opacity-100" : "opacity-0",
                        )}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                type="button"
                                variant="secondary"
                                size="icon-sm"
                                className="size-6"
                                aria-label={`Aksi untuk ${item.title}`}
                              >
                                <MoreHorizontal className="size-3" aria-hidden />
                              </Button>
                            }
                          />
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setRenameTarget(item);
                                setRenameValue(item.title);
                              }}
                            >
                              <PencilLine className="size-3.5" aria-hidden />
                              Ubah nama
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDuplicate(item.id)}
                            >
                              <Copy className="size-3.5" aria-hidden />
                              Duplikat
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setDeleteTarget(item)}
                            >
                              <Trash2 className="size-3.5" aria-hidden />
                              Hapus papan
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <ul className="space-y-1.5">
              {boardList.map((item, index) => (
                <li key={item.id}>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <button
                          type="button"
                          onClick={() => void openBoard(item.id)}
                          className={cn(
                            "flex size-7 items-center justify-center rounded-md text-[11px] font-semibold transition-colors",
                            item.id === selectedId
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:bg-muted",
                          )}
                        >
                          {index + 1}
                        </button>
                      }
                    />
                    <TooltipContent side="right">{item.title}</TooltipContent>
                  </Tooltip>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-border border-t p-2">
          {railOpen ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-full gap-1.5 text-xs"
              disabled={pending}
              onClick={handleCreate}
            >
              <Plus className="size-3.5" aria-hidden />
              Papan baru
            </Button>
          ) : (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    className="size-7"
                    disabled={pending}
                    onClick={handleCreate}
                    aria-label="Papan baru"
                  >
                    <Plus className="size-3.5" aria-hidden />
                  </Button>
                }
              />
              <TooltipContent side="right">Papan baru</TooltipContent>
            </Tooltip>
          )}
        </div>
      </aside>

      {/* Kanvas */}
      <div className="relative min-w-0 flex-1">
        {board ? (
          <>
            <div className="border-border bg-card/80 absolute inset-x-0 top-0 z-10 flex items-center gap-2 border-b px-3 py-1.5 backdrop-blur">
              <button
                type="button"
                onClick={() => {
                  const item = boardList.find((b) => b.id === board.id);
                  if (item) {
                    setRenameTarget(item);
                    setRenameValue(item.title);
                  }
                }}
                className="text-foreground hover:text-primary truncate text-sm font-semibold"
                title="Klik untuk mengubah nama"
              >
                {board.title}
              </button>
              <div className="flex-1" />
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1.5 text-xs"
                    >
                      <PresentationIcon className="size-3.5" aria-hidden />
                      Latar
                    </Button>
                  }
                />
                <DropdownMenuContent align="end">
                  {WHITEBOARD_BACKGROUNDS.map((bg) => (
                    <DropdownMenuItem
                      key={bg}
                      onClick={() => handleBackground(bg)}
                      className={cn(board.background === bg && "bg-accent")}
                    >
                      {backgroundLabel(bg)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="size-7"
                      aria-label="Aksi papan"
                    >
                      <MoreHorizontal className="size-3.5" aria-hidden />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => {
                      const item = boardList.find((b) => b.id === board.id);
                      if (item) {
                        setRenameTarget(item);
                        setRenameValue(item.title);
                      }
                    }}
                  >
                    <PencilLine className="size-3.5" aria-hidden />
                    Ubah nama
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDuplicate(board.id)}>
                    <Copy className="size-3.5" aria-hidden />
                    Duplikat
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => {
                      const item = boardList.find((b) => b.id === board.id);
                      if (item) setDeleteTarget(item);
                    }}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                    Hapus papan
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="absolute inset-0 top-9">
              {loadingBoard ? (
                <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
                  Memuat papan…
                </div>
              ) : (
                <BoardCanvas
                  key={board.id}
                  roomId={roomId}
                  board={board}
                  initialElements={elements}
                  currentUser={currentUser}
                  onRequestRename={() => {
                    const item = boardList.find((b) => b.id === board.id);
                    if (item) {
                      setRenameTarget(item);
                      setRenameValue(item.title);
                    }
                  }}
                />
              )}
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
            <span className="bg-primary/10 flex size-12 items-center justify-center rounded-xl">
              <LayoutTemplate className="text-primary size-6" aria-hidden />
            </span>
            <div>
              <p className="text-foreground text-sm font-semibold">
                Belum ada papan di view ini
              </p>
              <p className="text-muted-foreground mt-1 max-w-sm text-xs">
                Buat papan pertama untuk mulai brainstorming bersama — sticky
                note, diagram, coretan, dan gambar, semuanya tersinkron realtime
                dengan anggota ruangan lain.
              </p>
            </div>
            <Button
              type="button"
              className="gap-1.5"
              disabled={pending}
              onClick={handleCreate}
            >
              <Plus className="size-4" aria-hidden />
              Buat papan pertama
            </Button>
          </div>
        )}
      </div>

      {/* Dialog ubah nama */}
      <Dialog
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Ubah nama papan</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              handleRename();
            }}
            className="space-y-3"
          >
            <div className="space-y-1.5">
              <Label htmlFor="whiteboard-rename">Nama papan</Label>
              <Input
                id="whiteboard-rename"
                value={renameValue}
                maxLength={120}
                autoFocus
                onChange={(event) => setRenameValue(event.target.value)}
              />
            </div>
            <DialogFooter>
              <Button
                type="submit"
                disabled={pending || !renameValue.trim()}
              >
                Simpan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog hapus */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Hapus papan?</DialogTitle>
            <DialogDescription>
              Papan <strong>{deleteTarget?.title}</strong> beserta seluruh
              objek di dalamnya akan dihapus permanen. Tindakan ini tidak bisa
              dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={handleDelete}
            >
              Hapus papan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function backgroundLabel(background: string): string {
  switch (background) {
    case "dots":
      return "Titik";
    case "grid":
      return "Kotak";
    case "lines":
      return "Garis";
    default:
      return "Polos";
  }
}
