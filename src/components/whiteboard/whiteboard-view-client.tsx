"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Link2,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  PencilLine,
  Plus,
  Search,
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
import {
  WHITEBOARD_BACKGROUNDS,
  type WhiteboardBackground,
} from "@/lib/whiteboard/types";
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
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { BoardCanvas, type BoardMeta } from "./board-canvas";

/**
 * Kulit luar view Whiteboard: daftar papan di sisi kiri + kanvas aktif.
 *
 * Berpindah papan me-*remount* kanvas lewat `key`, jadi tiap papan selalu
 * mulai dengan state, riwayat undo, dan koneksi realtime yang bersih.
 * Papan yang terbuka dicatat di URL (`?board=`) supaya tautannya bisa
 * dibagikan dan halaman yang dimuat ulang kembali ke papan yang sama.
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
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [pending, setPending] = useState(false);
  const [railOpen, setRailOpen] = useState(true);
  const [query, setQuery] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(
    activeBoard?.id ?? null,
  );
  const [board, setBoard] = useState<BoardMeta | null>(activeBoard);
  const [elements, setElements] = useState<SerializedElement[]>(activeElements);
  const [loadingBoard, setLoadingBoard] = useState(false);
  /** Pratinjau yang baru disimpan kanvas, sebelum props server menyusul. */
  const [freshThumbnails, setFreshThumbnails] = useState<Record<string, string>>(
    {},
  );

  const [renameTarget, setRenameTarget] = useState<WhiteboardListItem | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<WhiteboardListItem | null>(null);

  const fullscreen = useFullscreen();
  const now = useNow();

  // Data papan aktif dari server berubah (mis. setelah rename) — ikuti.
  const activeBoardId = activeBoard?.id ?? null;
  useEffect(() => {
    if (!activeBoardId || activeBoardId !== selectedId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- menyelaraskan salinan lokal dengan data server setelah router.refresh()
    setBoard(activeBoard);
  }, [activeBoard, activeBoardId, selectedId]);

  const rememberBoardInUrl = useCallback((boardId: string | null) => {
    const url = new URL(window.location.href);
    if (boardId) url.searchParams.set("board", boardId);
    else url.searchParams.delete("board");
    window.history.replaceState(window.history.state, "", url);
  }, []);

  const openBoard = useCallback(
    async (boardId: string, options: { force?: boolean } = {}) => {
      if (boardId === selectedId && !options.force) return;
      const previous = board?.id ?? null;
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
        rememberBoardInUrl(boardId);
      } catch (error) {
        toast.error(actionErrorMessage(error, "Papan gagal dimuat."));
        setSelectedId(previous);
      } finally {
        setLoadingBoard(false);
      }
    },
    [roomId, selectedId, board?.id, rememberBoardInUrl],
  );

  const handleCreate = useCallback(() => {
    setPending(true);
    void (async () => {
      try {
        const created = await createRoomWhiteboard({ viewId });
        toast.success("Papan baru dibuat.");
        router.refresh();
        await openBoard(created.id, { force: true });
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
          await openBoard(created.id, { force: true });
        } catch (error) {
          toast.error(actionErrorMessage(error, "Gagal menduplikasi papan."));
        } finally {
          setPending(false);
        }
      })();
    },
    [router, openBoard],
  );

  const renameBoard = useCallback(
    async (target: WhiteboardListItem, rawTitle: string) => {
      const title = rawTitle.trim();
      if (!title || title === target.title) return true;
      setPending(true);
      try {
        await renameRoomWhiteboard({ boardId: target.id, title });
        setBoard((prev) =>
          prev && prev.id === target.id ? { ...prev, title } : prev,
        );
        toast.success("Nama papan diperbarui.");
        router.refresh();
        return true;
      } catch (error) {
        toast.error(actionErrorMessage(error, "Gagal mengubah nama papan."));
        return false;
      } finally {
        setPending(false);
      }
    },
    [router],
  );

  const handleRenameDialog = useCallback(() => {
    const target = renameTarget;
    if (!target) return;
    void renameBoard(target, renameValue).then((ok) => {
      if (ok) setRenameTarget(null);
    });
  }, [renameTarget, renameValue, renameBoard]);

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
            await openBoard(fallback.id, { force: true });
          } else {
            setSelectedId(null);
            setBoard(null);
            setElements([]);
            rememberBoardInUrl(null);
          }
        }
        router.refresh();
      } catch (error) {
        toast.error(actionErrorMessage(error, "Gagal menghapus papan."));
      } finally {
        setPending(false);
      }
    })();
  }, [deleteTarget, selectedId, boards, router, openBoard, rememberBoardInUrl]);

  const handleBackground = useCallback(
    (background: string) => {
      if (!board) return;
      const previous = board.background;
      setBoard({ ...board, background });
      void setRoomWhiteboardBackground({ boardId: board.id, background }).catch(
        (error: unknown) => {
          setBoard((prev) =>
            prev && prev.id === board.id ? { ...prev, background: previous } : prev,
          );
          toast.error(actionErrorMessage(error, "Gagal mengubah latar papan."));
        },
      );
    },
    [board],
  );

  const copyBoardLink = useCallback(
    (boardId: string) => {
      const url = new URL(window.location.href);
      url.search = "";
      url.searchParams.set("board", boardId);
      void navigator.clipboard
        .writeText(url.toString())
        .then(() => toast.success("Tautan papan disalin."))
        .catch(() => toast.error("Tautan gagal disalin."));
    },
    [],
  );

  const boardList = useMemo(() => {
    // Papan yang baru dibuat mungkin belum ada di props hasil server render.
    const list =
      !board || boards.some((b) => b.id === board.id)
        ? boards
        : [
            ...boards,
            {
              id: board.id,
              title: board.title,
              rev: board.rev,
              background: board.background,
              thumbnail: null,
              updatedAt: new Date(0).toISOString(),
              lastEditedByName: null,
            },
          ];
    return list.map((item) =>
      freshThumbnails[item.id]
        ? { ...item, thumbnail: freshThumbnails[item.id]! }
        : item,
    );
  }, [boards, board, freshThumbnails]);

  const filteredBoards = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return boardList;
    return boardList.filter((item) => item.title.toLowerCase().includes(needle));
  }, [boardList, query]);

  const activeItem = board ? boardList.find((b) => b.id === board.id) : undefined;

  const openRename = (item: WhiteboardListItem) => {
    setRenameTarget(item);
    setRenameValue(item.title);
  };

  return (
    <div
      ref={shellRef}
      data-whiteboard-shell
      className={cn(
        "border-border bg-card flex min-h-0 flex-1 overflow-hidden",
        // z-40: di atas navigasi aplikasi, tapi di bawah popup (z-50 ke atas)
        // supaya dropdown, tooltip, dialog & toast tetap tampil.
        fullscreen.active
          ? "fixed inset-0 z-40 rounded-none border-0"
          : "rounded-2xl border",
      )}
    >
      {/* Rail daftar papan */}
      <aside
        aria-label="Daftar papan"
        className={cn(
          "border-border bg-muted/25 flex shrink-0 flex-col border-r transition-[width] duration-200 motion-reduce:transition-none",
          railOpen ? "w-14 md:w-64" : "w-14",
        )}
      >
        <div className="flex h-12 items-center gap-2 px-2.5">
          <div
            className={cn(
              "min-w-0 flex-1 items-baseline gap-1.5 pl-1",
              railOpen ? "hidden md:flex" : "hidden",
            )}
          >
            <span className="text-foreground text-sm font-semibold">Papan</span>
            <span className="text-muted-foreground text-xs tabular-nums">
              {boardList.length}
            </span>
          </div>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="mx-auto hidden size-8 shrink-0 md:mx-0 md:inline-flex"
                  onClick={() => setRailOpen((open) => !open)}
                  aria-label={railOpen ? "Sembunyikan daftar" : "Tampilkan daftar"}
                  aria-expanded={railOpen}
                >
                  {railOpen ? (
                    <ChevronLeft className="size-4" aria-hidden />
                  ) : (
                    <ChevronRight className="size-4" aria-hidden />
                  )}
                </Button>
              }
            />
            <TooltipContent side="right">
              {railOpen ? "Sembunyikan daftar papan" : "Tampilkan daftar papan"}
            </TooltipContent>
          </Tooltip>
        </div>

        {boardList.length > 4 ? (
          <div className={cn("px-2.5 pb-2", railOpen ? "hidden md:block" : "hidden")}>
            <div className="relative">
              <Search
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
                aria-hidden
              />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari papan"
                aria-label="Cari papan"
                className="h-8 rounded-lg pl-8 text-xs"
              />
            </div>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-2">
          {/* Daftar lebar — hanya di layar md ke atas saat rail terbuka. */}
          <ul className={cn("space-y-2", railOpen ? "hidden md:block" : "hidden")}>
            {filteredBoards.map((item) => (
              <li key={item.id}>
                <BoardCard
                  item={item}
                  active={item.id === selectedId}
                  now={now}
                  onOpen={() => void openBoard(item.id)}
                  onRename={() => openRename(item)}
                  onDuplicate={() => handleDuplicate(item.id)}
                  onCopyLink={() => copyBoardLink(item.id)}
                  onDelete={() => setDeleteTarget(item)}
                />
              </li>
            ))}
            {filteredBoards.length === 0 ? (
              <li className="text-muted-foreground px-1 py-6 text-center text-xs">
                Tidak ada papan bernama &ldquo;{query.trim()}&rdquo;.
              </li>
            ) : null}
          </ul>

          {/* Daftar ringkas: rail tertutup, atau layar sempit. */}
          <ul
            className={cn(
              "flex-col items-center gap-1.5",
              railOpen ? "flex md:hidden" : "flex",
            )}
          >
            {boardList.map((item, index) => (
              <li key={item.id}>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        onClick={() => void openBoard(item.id)}
                        aria-label={item.title}
                        aria-current={item.id === selectedId ? "page" : undefined}
                        className={cn(
                          "focus-visible:ring-ring flex size-9 items-center justify-center rounded-xl text-xs font-semibold tabular-nums outline-none transition-colors focus-visible:ring-2",
                          item.id === selectedId
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
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
        </div>

        <div className="border-border border-t p-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "h-9 w-full gap-1.5 rounded-xl text-xs",
              railOpen ? "hidden md:inline-flex" : "hidden",
            )}
            disabled={pending}
            onClick={handleCreate}
          >
            <Plus className="size-3.5" aria-hidden />
            Papan baru
          </Button>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className={cn(
                    "mx-auto size-9 rounded-xl",
                    railOpen ? "flex md:hidden" : "flex",
                  )}
                  disabled={pending}
                  onClick={handleCreate}
                  aria-label="Papan baru"
                >
                  <Plus className="size-4" aria-hidden />
                </Button>
              }
            />
            <TooltipContent side="right">Papan baru</TooltipContent>
          </Tooltip>
        </div>
      </aside>

      {/* Kanvas */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        {board ? (
          <>
            <header className="border-border flex h-12 shrink-0 items-center gap-1.5 border-b px-2 sm:px-3">
              <InlineTitle
                key={board.id + board.title}
                title={board.title}
                disabled={pending}
                onSubmit={(title) =>
                  activeItem ? renameBoard(activeItem, title) : Promise.resolve(true)
                }
              />
              <div className="flex-1" />

              <BackgroundPicker
                value={board.background as WhiteboardBackground}
                onChange={handleBackground}
              />

              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="size-8"
                      onClick={() => copyBoardLink(board.id)}
                      aria-label="Salin tautan papan"
                    >
                      <Link2 className="size-4" aria-hidden />
                    </Button>
                  }
                />
                <TooltipContent side="bottom">Salin tautan papan</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="size-8"
                      onClick={fullscreen.toggle}
                      aria-label={
                        fullscreen.active ? "Keluar layar penuh" : "Layar penuh"
                      }
                      aria-pressed={fullscreen.active}
                    >
                      {fullscreen.active ? (
                        <Minimize2 className="size-4" aria-hidden />
                      ) : (
                        <Maximize2 className="size-4" aria-hidden />
                      )}
                    </Button>
                  }
                />
                <TooltipContent side="bottom">
                  {fullscreen.active ? "Keluar layar penuh (Esc)" : "Layar penuh"}
                </TooltipContent>
              </Tooltip>

              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="size-8"
                      aria-label="Aksi papan"
                    >
                      <MoreHorizontal className="size-4" aria-hidden />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end" className="w-48">
                  <BoardMenuItems
                    onRename={() => activeItem && openRename(activeItem)}
                    onDuplicate={() => handleDuplicate(board.id)}
                    onCopyLink={() => copyBoardLink(board.id)}
                    onDelete={() => activeItem && setDeleteTarget(activeItem)}
                  />
                </DropdownMenuContent>
              </DropdownMenu>
            </header>

            <div className="relative min-h-0 flex-1">
              {loadingBoard ? (
                <BoardLoading />
              ) : (
                <BoardCanvas
                  key={board.id}
                  roomId={roomId}
                  board={board}
                  initialElements={elements}
                  currentUser={currentUser}
                  onThumbnailSaved={(thumbnail) =>
                    setFreshThumbnails((prev) => ({ ...prev, [board.id]: thumbnail }))
                  }
                />
              )}
            </div>
          </>
        ) : loadingBoard ? (
          <BoardLoading />
        ) : (
          <EmptyView pending={pending} onCreate={handleCreate} />
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
              handleRenameDialog();
            }}
            className="space-y-4"
          >
            <Input
              aria-label="Nama papan"
              value={renameValue}
              maxLength={120}
              autoFocus
              onChange={(event) => setRenameValue(event.target.value)}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRenameTarget(null)}
              >
                Batal
              </Button>
              <Button type="submit" disabled={pending || !renameValue.trim()}>
                Simpan nama
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
            <DialogTitle>Hapus papan ini?</DialogTitle>
            <DialogDescription>
              <strong className="text-foreground">{deleteTarget?.title}</strong>{" "}
              dan semua isinya akan dihapus permanen untuk semua anggota ruangan.
              Tindakan ini tidak bisa dibatalkan.
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

// ---------------------------------------------------------------------------
// Rail
// ---------------------------------------------------------------------------

function BoardCard({
  item,
  active,
  now,
  onOpen,
  onRename,
  onDuplicate,
  onCopyLink,
  onDelete,
}: {
  item: WhiteboardListItem;
  active: boolean;
  now: number | null;
  onOpen: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onCopyLink: () => void;
  onDelete: () => void;
}) {
  const edited = describeEdited(item, now);
  return (
    <div
      className={cn(
        "group bg-card relative overflow-hidden rounded-xl border transition-[border-color,box-shadow]",
        active
          ? "border-primary/70 ring-primary/20 shadow-sm ring-2"
          : "border-border hover:border-foreground/25",
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        onDoubleClick={onRename}
        aria-current={active ? "page" : undefined}
        className="focus-visible:ring-ring block w-full rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-inset"
      >
        <span
          className="bg-muted/50 relative block h-24 w-full overflow-hidden"
          style={backgroundSwatchStyle(item.background as WhiteboardBackground)}
        >
          {item.thumbnail ? (
            <Image
              src={item.thumbnail}
              alt=""
              fill
              sizes="240px"
              className="object-cover"
              unoptimized
            />
          ) : null}
        </span>
        <span className="block px-2.5 pt-2 pb-2.5">
          <span className="text-foreground block truncate pr-6 text-sm font-medium">
            {item.title}
          </span>
          <span
            className="text-muted-foreground mt-0.5 block truncate text-xs"
            suppressHydrationWarning
          >
            {edited}
          </span>
        </span>
      </button>

      <div
        className={cn(
          "absolute right-1.5 bottom-2 transition-opacity group-hover:opacity-100 focus-within:opacity-100",
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
                variant="ghost"
                size="icon-sm"
                className="size-7 rounded-lg"
                aria-label={`Aksi untuk ${item.title}`}
              >
                <MoreHorizontal className="size-3.5" aria-hidden />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-48">
            <BoardMenuItems
              onRename={onRename}
              onDuplicate={onDuplicate}
              onCopyLink={onCopyLink}
              onDelete={onDelete}
            />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function BoardMenuItems({
  onRename,
  onDuplicate,
  onCopyLink,
  onDelete,
}: {
  onRename: () => void;
  onDuplicate: () => void;
  onCopyLink: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <DropdownMenuItem onClick={onRename}>
        <PencilLine className="size-3.5" aria-hidden />
        Ubah nama
      </DropdownMenuItem>
      <DropdownMenuItem onClick={onDuplicate}>
        <Copy className="size-3.5" aria-hidden />
        Duplikat papan
      </DropdownMenuItem>
      <DropdownMenuItem onClick={onCopyLink}>
        <Link2 className="size-3.5" aria-hidden />
        Salin tautan
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem variant="destructive" onClick={onDelete}>
        <Trash2 className="size-3.5" aria-hidden />
        Hapus papan
      </DropdownMenuItem>
    </>
  );
}

// ---------------------------------------------------------------------------
// Header kanvas
// ---------------------------------------------------------------------------

/** Judul papan yang bisa langsung diedit: klik, ketik, Enter. */
function InlineTitle({
  title,
  disabled,
  onSubmit,
}: {
  title: string;
  disabled: boolean;
  onSubmit: (title: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);

  const finish = async () => {
    if (!value.trim()) {
      setValue(title);
      setEditing(false);
      return;
    }
    const ok = await onSubmit(value);
    if (ok) setEditing(false);
  };

  if (editing) {
    return (
      <form
        className="flex min-w-0 items-center gap-1"
        onSubmit={(event) => {
          event.preventDefault();
          void finish();
        }}
      >
        <Input
          value={value}
          autoFocus
          maxLength={120}
          aria-label="Nama papan"
          disabled={disabled}
          onChange={(event) => setValue(event.target.value)}
          onBlur={() => void finish()}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setValue(title);
              setEditing(false);
            }
          }}
          onFocus={(event) => event.currentTarget.select()}
          className="h-8 w-56 max-w-[45vw] rounded-lg text-sm font-semibold"
        />
        <Button
          type="submit"
          size="icon-sm"
          variant="ghost"
          className="size-8"
          aria-label="Simpan nama"
          onMouseDown={(event) => event.preventDefault()}
        >
          <Check className="size-4" aria-hidden />
        </Button>
      </form>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="hover:bg-muted focus-visible:ring-ring min-w-0 truncate rounded-lg px-2 py-1 text-left text-sm font-semibold outline-none focus-visible:ring-2"
          >
            {title}
          </button>
        }
      />
      <TooltipContent side="bottom">Klik untuk mengubah nama</TooltipContent>
    </Tooltip>
  );
}

const BACKGROUND_LABELS: Record<WhiteboardBackground, string> = {
  dots: "Titik",
  grid: "Kotak",
  lines: "Garis",
  plain: "Polos",
};

function BackgroundPicker({
  value,
  onChange,
}: {
  value: WhiteboardBackground;
  onChange: (background: WhiteboardBackground) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-2 rounded-lg px-2 text-xs"
            aria-label={`Latar papan: ${BACKGROUND_LABELS[value] ?? "Titik"}`}
          >
            <span
              className="border-border bg-background size-4 rounded border"
              style={backgroundSwatchStyle(value, 6)}
              aria-hidden
            />
            <span className="hidden sm:inline">Latar</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-auto p-2">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Latar papan</DropdownMenuLabel>
          <div className="mt-1 grid grid-cols-4 gap-1.5">
            {WHITEBOARD_BACKGROUNDS.map((bg) => (
              <DropdownMenuItem
                key={bg}
                onClick={() => onChange(bg)}
                className={cn(
                  "flex-col gap-1.5 rounded-lg px-1.5 py-1.5 text-[11px]",
                  value === bg && "bg-accent",
                )}
              >
                <span
                  className={cn(
                    "bg-background block size-11 rounded-md border",
                    value === bg ? "border-primary" : "border-border",
                  )}
                  style={backgroundSwatchStyle(bg, 8)}
                  aria-hidden
                />
                {BACKGROUND_LABELS[bg]}
              </DropdownMenuItem>
            ))}
          </div>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Pola CSS yang meniru latar kanvas, untuk pratinjau kecil. */
function backgroundSwatchStyle(
  background: WhiteboardBackground,
  gap = 12,
): React.CSSProperties {
  const ink = "color-mix(in oklab, var(--foreground) 22%, transparent)";
  switch (background) {
    case "grid":
      return {
        backgroundImage: `linear-gradient(${ink} 1px, transparent 1px), linear-gradient(90deg, ${ink} 1px, transparent 1px)`,
        backgroundSize: `${gap}px ${gap}px`,
      };
    case "lines":
      return {
        backgroundImage: `linear-gradient(${ink} 1px, transparent 1px)`,
        backgroundSize: `${gap}px ${gap}px`,
      };
    case "plain":
      return {};
    default:
      return {
        backgroundImage: `radial-gradient(${ink} 1px, transparent 1.2px)`,
        backgroundSize: `${gap}px ${gap}px`,
      };
  }
}

// ---------------------------------------------------------------------------
// Keadaan kosong & memuat
// ---------------------------------------------------------------------------

function BoardLoading() {
  return (
    <div
      className="flex h-full items-center justify-center"
      role="status"
      aria-live="polite"
      style={backgroundSwatchStyle("dots", 24)}
    >
      <span className="border-border bg-card text-muted-foreground flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs shadow-sm">
        <span className="border-muted-foreground/30 border-t-foreground size-3.5 animate-spin rounded-full border-2 motion-reduce:animate-none" />
        Membuka papan
      </span>
    </div>
  );
}

/** Tiga sticky miring sebagai ilustrasi — mengisyaratkan apa yang bisa dibuat. */
function EmptyView({
  pending,
  onCreate,
}: {
  pending: boolean;
  onCreate: () => void;
}) {
  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-6 p-8 text-center"
      style={backgroundSwatchStyle("dots", 24)}
    >
      <div className="relative h-28 w-48" aria-hidden>
        <span className="absolute top-3 left-2 size-20 -rotate-6 rounded-sm bg-[#fef08a] shadow-md dark:bg-[#713f12]" />
        <span className="absolute top-0 left-14 size-20 rotate-3 rounded-sm bg-[#fbcfe8] shadow-md dark:bg-[#831843]" />
        <span className="absolute top-5 left-26 size-20 rotate-[8deg] rounded-sm bg-[#bfdbfe] shadow-md dark:bg-[#1e3a8a]" />
      </div>
      <div className="max-w-sm">
        <p className="text-foreground text-lg font-semibold">
          Mulai papan pertama
        </p>
        <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
          Tuangkan ide dengan sticky note, gambar alur dengan konektor, dan
          coret bersama — semua anggota ruangan melihat perubahannya seketika.
        </p>
      </div>
      <Button
        type="button"
        className="gap-1.5 rounded-xl"
        disabled={pending}
        onClick={onCreate}
      >
        <Plus className="size-4" aria-hidden />
        Buat papan
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Utilitas
// ---------------------------------------------------------------------------

/**
 * Mode layar penuh untuk papan.
 *
 * Yang dijadikan fullscreen adalah seluruh dokumen, BUKAN kotak whiteboard.
 * Dropdown, tooltip, dialog, dan toast dirender lewat portal ke
 * `document.body`; kalau hanya kotak whiteboard yang fullscreen, semua
 * popup itu berada di luar elemen fullscreen dan tidak pernah tampil.
 * Kotak whiteboard sendiri dibuat menutupi viewport (`fixed inset-0`) selama
 * mode ini aktif.
 *
 * Browser tanpa Fullscreen API (mis. Safari iPhone) tetap mendapat mode
 * fokus yang sama — hanya tanpa menyembunyikan bilah browser.
 */
function useFullscreen() {
  const [active, setActive] = useState(false);

  const exit = useCallback(() => {
    setActive(false);
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    }
  }, []);

  const toggle = useCallback(() => {
    if (active) {
      exit();
      return;
    }
    setActive(true);
    const root = document.documentElement;
    if (typeof root.requestFullscreen === "function" && !document.fullscreenElement) {
      // Ditolak (mis. di dalam iframe) bukan masalah: mode fokus tetap jalan.
      void root.requestFullscreen().catch(() => undefined);
    }
  }, [active, exit]);

  useEffect(() => {
    if (!active) return;
    // Keluar fullscreen browser (Esc / F11) ikut mengakhiri mode papan.
    let entered = Boolean(document.fullscreenElement);
    const onChange = () => {
      if (document.fullscreenElement) {
        entered = true;
      } else if (entered) {
        setActive(false);
      }
    };
    // Tanpa fullscreen browser, Esc tidak "ditelan" browser — tangani
    // sendiri, tapi jangan rebut Esc dari dialog/menu/editor teks.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || document.fullscreenElement) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (document.querySelector("[role=dialog], [role=menu]")) return;
      setActive(false);
    };
    // Halaman di belakang tidak boleh ikut ter-scroll.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("fullscreenchange", onChange);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("fullscreenchange", onChange);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [active]);

  // Pindah halaman saat masih fullscreen: jangan tinggalkan browser terkunci
  // di layar penuh tanpa tombol keluar.
  useEffect(
    () => () => {
      if (document.fullscreenElement) {
        void document.exitFullscreen().catch(() => undefined);
      }
    },
    [],
  );

  return { active, toggle };
}

/** Waktu sekarang yang diperbarui tiap menit; `null` saat render server. */
function useNow(): number | null {
  return useSyncExternalStore(
    (onChange) => {
      const id = window.setInterval(onChange, 60_000);
      return () => window.clearInterval(id);
    },
    () => Math.floor(Date.now() / 60_000) * 60_000,
    () => null,
  );
}

const relativeFormat = new Intl.RelativeTimeFormat("id", { numeric: "auto" });

function describeEdited(item: WhiteboardListItem, now: number | null): string {
  const time = new Date(item.updatedAt).getTime();
  if (!time) return "Baru dibuat";
  let when: string;
  if (now === null) {
    when = new Date(time).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
    });
  } else {
    const minutes = Math.round((time - now) / 60_000);
    if (Math.abs(minutes) < 1) when = "baru saja";
    else if (Math.abs(minutes) < 60) when = relativeFormat.format(minutes, "minute");
    else if (Math.abs(minutes) < 60 * 24)
      when = relativeFormat.format(Math.round(minutes / 60), "hour");
    else if (Math.abs(minutes) < 60 * 24 * 30)
      when = relativeFormat.format(Math.round(minutes / 1440), "day");
    else
      when = new Date(time).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
  }
  const capitalized = when.charAt(0).toUpperCase() + when.slice(1);
  return item.lastEditedByName
    ? `${capitalized} oleh ${item.lastEditedByName}`
    : `Diubah ${when}`;
}
