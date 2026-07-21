"use client";
import { actionErrorMessage } from "@/lib/action-error-message";

import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  BookOpen,
  Check,
  ChevronRight,
  CloudOff,
  FileText,
  GripVertical,
  Link2,
  ListTree,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Tag,
  Trash2,
} from "lucide-react";
import {
  deleteRoomWikiPage,
  heartbeatRoomWikiPage,
  releaseRoomWikiLock,
  reorderRoomWikiPages,
  uploadRoomWikiAttachment,
  upsertRoomWikiPage,
  updateRoomWikiPageOrganization,
} from "@/actions/room-view-wiki";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/rich-text-editor";
import { WikiPageDownloadMenu } from "@/components/wiki-page-download-menu";
import { WikiVersionHistory } from "@/components/wiki-version-history";
import {
  WikiCommentsSheet,
  WikiPresenceRow,
  type WikiCollaborationState,
} from "@/components/wiki-collaboration-panel";
import type { RoomMemberAvatarUser } from "@/components/room-member-avatar-stack";
import { cn } from "@/lib/utils";
import {
  parseWikiDraft,
  shouldRecoverWikiDraft,
  wikiDraftStorageKey,
  type WikiDraft,
} from "@/lib/wiki-draft";
import {
  buildWikiTree,
  findWikiBacklinks,
  normalizeWikiTags,
  searchWikiPages,
  wikiSearchSnippet,
  type WikiTreeNode,
} from "@/lib/wiki-organization";

type Page = {
  id: string;
  parentId: string | null;
  title: string;
  content: string;
  tags: string[];
  revision: number;
  updatedAt: string;
  updatedByName: string | null;
};

type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error" | "conflict";

type SaveConflict = {
  id: string;
  revision: number;
  title: string;
  content: string;
  updatedAt: string;
};

const AUTOSAVE_DELAY_MS = 800;

function treeStorageKey(viewId: string) {
  return `dcc:wiki-tree:${viewId}`;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type OptimisticAction =
  | { type: "delete_page"; pageId: string }
  | { type: "reorder_siblings"; parentId: string | null; orderedIds: string[] };

function applyOptimistic(state: Page[], action: OptimisticAction): Page[] {
  switch (action.type) {
    case "delete_page":
      return state.filter((p) => p.id !== action.pageId);
    case "reorder_siblings": {
      // Susun ulang sibling pada slot posisi yang sama di array flat supaya
      // urutan relatif terhadap halaman parent lain tidak berubah.
      const byId = new Map(state.map((page) => [page.id, page]));
      const orderedPages = action.orderedIds
        .map((id) => byId.get(id))
        .filter((page): page is Page => Boolean(page));
      const result = [...state];
      let slot = 0;
      for (let i = 0; i < result.length && slot < orderedPages.length; i += 1) {
        if (result[i].parentId === action.parentId) {
          result[i] = orderedPages[slot];
          slot += 1;
        }
      }
      return result;
    }
    default:
      return state;
  }
}

function countWikiDescendants(pages: Page[], rootId: string): number {
  let count = 0;
  const stack = [rootId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const page of pages) {
      if (page.parentId === current) {
        count += 1;
        stack.push(page.id);
      }
    }
  }
  return count;
}

export function WikiViewClient({
  roomId,
  viewId,
  currentUserId,
  members,
  pages: initialPages,
}: {
  roomId: string;
  viewId: string;
  currentUserId: string;
  members: RoomMemberAvatarUser[];
  pages: Page[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [pages, applyAction] = useOptimistic<Page[], OptimisticAction>(
    initialPages,
    applyOptimistic,
  );

  const [requestedId, setRequestedId] = useState<string | null>(
    () => searchParams.get("page") ?? initialPages[0]?.id ?? null,
  );

  /** Pilih halaman + tulis `?page=` agar tahan refresh dan bisa dibagikan. */
  const selectPage = useCallback((pageId: string) => {
    setRequestedId(pageId);
    const params = new URLSearchParams(window.location.search);
    params.set("page", pageId);
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  }, []);

  /** Pilihan efektif: ambil halaman pertama bila id yang diminta tidak valid. */
  const selectedId = useMemo(() => {
    if (requestedId && pages.some((p) => p.id === requestedId)) {
      return requestedId;
    }
    return pages[0]?.id ?? null;
  }, [pages, requestedId]);

  const selected = useMemo(
    () => pages.find((p) => p.id === selectedId) ?? null,
    [pages, selectedId],
  );

  const ancestors = useMemo(() => {
    if (!selected) return [];
    const byId = new Map(pages.map((page) => [page.id, page]));
    const chain: Page[] = [];
    let cursor = selected.parentId ? byId.get(selected.parentId) : undefined;
    while (cursor && chain.length < 20) {
      chain.unshift(cursor);
      cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
    }
    return chain;
  }, [pages, selected]);

  // Status auto-save di-scope per halaman supaya tidak perlu mereset via effect
  // saat berpindah halaman — kita derive `saveStatus` dari `selectedId`.
  const [saveState, setSaveState] = useState<{
    pageId: string | null;
    status: SaveStatus;
  }>({ pageId: null, status: "idle" });
  const saveStatus: SaveStatus =
    saveState.pageId === selectedId ? saveState.status : "idle";

  /** Payload konflik per halaman agar pengguna bisa memilih pemulihan. */
  const [conflicts, setConflicts] = useState<Record<string, SaveConflict>>({});

  // Timer auto-save dipisah per halaman supaya berpindah halaman cepat tidak
  // membatalkan save yang sedang antri untuk halaman lain.
  const titleTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const contentTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  /** Judul & konten terbaru per halaman (dari editor), untuk auto-save & unduhan. */
  const latestTitleByPageIdRef = useRef<Map<string, string>>(new Map());
  const latestContentByPageIdRef = useRef<Map<string, string>>(new Map());
  const revisionsRef = useRef<Map<string, number>>(
    new Map(initialPages.map((page) => [page.id, page.revision])),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const searchResults = useMemo(
    () => (searchQuery.trim() ? searchWikiPages(pages, searchQuery) : []),
    [pages, searchQuery],
  );
  const pageTree = useMemo(() => buildWikiTree(pages), [pages]);
  const backlinks = useMemo(
    () => (selected ? findWikiBacklinks(pages, selected.id) : []),
    [pages, selected],
  );
  const saveChainsRef = useRef<Map<string, Promise<void>>>(new Map());

  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    // Ditunda satu tick agar hidrasi server/klien tetap identik.
    const timeout = window.setTimeout(() => {
      try {
        const raw = localStorage.getItem(treeStorageKey(viewId));
        if (!raw) return;
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setCollapsedIds(new Set(parsed.filter((id): id is string => typeof id === "string")));
        }
      } catch {
        // State collapse hanya kenyamanan; abaikan storage rusak.
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [viewId]);
  const toggleCollapsed = useCallback(
    (pageId: string) => {
      setCollapsedIds((prev) => {
        const next = new Set(prev);
        if (next.has(pageId)) next.delete(pageId);
        else next.add(pageId);
        try {
          localStorage.setItem(treeStorageKey(viewId), JSON.stringify([...next]));
        } catch {
          // Abaikan; collapse tetap bekerja untuk sesi ini.
        }
        return next;
      });
    },
    [viewId],
  );

  const persistPage = useCallback(
    (page: Page, patch: { title?: string; content?: string }) => {
      const rawTitle =
        patch.title ??
        latestTitleByPageIdRef.current.get(page.id) ??
        page.title;
      const resolvedTitle = rawTitle.trim() ? rawTitle : page.title;
      const resolvedContent =
        patch.content ??
        latestContentByPageIdRef.current.get(page.id) ??
        page.content;
      const snapshot = { title: resolvedTitle, content: resolvedContent };
      const previous = saveChainsRef.current.get(page.id) ?? Promise.resolve();
      const next = previous
        .catch(() => undefined)
        .then(async () => {
          setSaveState({ pageId: page.id, status: "saving" });
          try {
            const result = await upsertRoomWikiPage({
              id: page.id,
              viewId,
              title: snapshot.title,
              content: snapshot.content,
              baseRevision: revisionsRef.current.get(page.id) ?? page.revision,
            });
            if (result.conflict) {
              setSaveState({ pageId: page.id, status: "conflict" });
              setConflicts((prev) => ({ ...prev, [page.id]: result }));
              return;
            }
            revisionsRef.current.set(page.id, result.revision);
            setConflicts((prev) => {
              if (!(page.id in prev)) return prev;
              const rest = { ...prev };
              delete rest[page.id];
              return rest;
            });
            const latestTitle = latestTitleByPageIdRef.current.get(page.id) ?? page.title;
            const latestContent = latestContentByPageIdRef.current.get(page.id) ?? page.content;
            if (latestTitle === snapshot.title && latestContent === snapshot.content) {
              localStorage.removeItem(wikiDraftStorageKey(page.id));
              setSaveState({ pageId: page.id, status: "saved" });
            }
          } catch (err) {
            setSaveState({ pageId: page.id, status: "error" });
            toast.error(actionErrorMessage(err, "Gagal menyimpan halaman. Draft lokal tetap aman."));
          }
        });
      saveChainsRef.current.set(page.id, next);
    },
    [viewId],
  );

  /** Jalankan save yang masih antri sekarang juga (keluar mode edit / unmount). */
  const flushPendingSaves = useCallback(
    (page: Page) => {
      const titleTimer = titleTimersRef.current.get(page.id);
      const contentTimer = contentTimersRef.current.get(page.id);
      if (titleTimer) {
        clearTimeout(titleTimer);
        titleTimersRef.current.delete(page.id);
      }
      if (contentTimer) {
        clearTimeout(contentTimer);
        contentTimersRef.current.delete(page.id);
      }
      if (titleTimer || contentTimer) persistPage(page, {});
    },
    [persistPage],
  );

  // Judul: JANGAN pakai useOptimistic + startTransition sinkron — pola itu
  // membuat state langsung revert ke props server sehingga input terkontrol
  // “kedip” / huruf hilang. Input judul pakai state lokal di PageEditor.
  const onTitleChange = useCallback(
    (page: Page, nextTitle: string) => {
      latestTitleByPageIdRef.current.set(page.id, nextTitle);
      setSaveState({ pageId: page.id, status: "dirty" });
      try {
        localStorage.setItem(
          wikiDraftStorageKey(page.id),
          JSON.stringify({
            pageId: page.id,
            title: nextTitle,
            content: latestContentByPageIdRef.current.get(page.id) ?? page.content,
            baseRevision: revisionsRef.current.get(page.id) ?? page.revision,
            savedAt: new Date().toISOString(),
          } satisfies WikiDraft),
        );
      } catch {
        // Browser dapat menolak localStorage; server auto-save tetap berjalan.
      }
      const existing = titleTimersRef.current.get(page.id);
      if (existing) clearTimeout(existing);
      if (!nextTitle.trim()) return;
      const t = setTimeout(() => {
        titleTimersRef.current.delete(page.id);
        persistPage(page, { title: nextTitle.trim() });
      }, AUTOSAVE_DELAY_MS);
      titleTimersRef.current.set(page.id, t);
    },
    [persistPage],
  );

  // Untuk konten kita TIDAK pakai optimistic update — editor (Tiptap) adalah
  // source of truth. Optimistic via startTransition sync menyebabkan state
  // langsung revert ke base, dan ditambah re-render parent saat user mengetik
  // bisa memicu Tiptap memanggil `setOptions` berulang-ulang. Cukup debounce
  // save ke server.
  const onContentChange = useCallback(
    (page: Page, nextContent: string) => {
      latestContentByPageIdRef.current.set(page.id, nextContent);
      if (!latestTitleByPageIdRef.current.has(page.id)) {
        latestTitleByPageIdRef.current.set(page.id, page.title);
      }
      setSaveState({ pageId: page.id, status: "dirty" });
      try {
        localStorage.setItem(
          wikiDraftStorageKey(page.id),
          JSON.stringify({
            pageId: page.id,
            title: latestTitleByPageIdRef.current.get(page.id) ?? page.title,
            content: nextContent,
            baseRevision: revisionsRef.current.get(page.id) ?? page.revision,
            savedAt: new Date().toISOString(),
          } satisfies WikiDraft),
        );
      } catch {
        // Browser dapat menolak localStorage; server auto-save tetap berjalan.
      }
      const existing = contentTimersRef.current.get(page.id);
      if (existing) clearTimeout(existing);
      const t = setTimeout(() => {
        contentTimersRef.current.delete(page.id);
        persistPage(page, { content: nextContent });
      }, AUTOSAVE_DELAY_MS);
      contentTimersRef.current.set(page.id, t);
    },
    [persistPage],
  );

  /** Halaman baru langsung dibuka dalam mode edit dengan judul terseleksi. */
  const [pendingEditId, setPendingEditId] = useState<string | null>(null);

  function onCreatePage(parentId: string | null = null) {
    startTransition(async () => {
      try {
        const res = await upsertRoomWikiPage({
          viewId,
          title: "Halaman baru",
          content: "",
          parentId,
        });
        if (res?.id) {
          revisionsRef.current.set(res.id, res.revision);
          setPendingEditId(res.id);
          selectPage(res.id);
        }
        router.refresh();
      } catch (err) {
        toast.error(
          actionErrorMessage(err, "Gagal membuat halaman."));
      }
    });
  }

  const [deleteCandidate, setDeleteCandidate] = useState<Page | null>(null);
  const deleteDescendants = deleteCandidate
    ? countWikiDescendants(pages, deleteCandidate.id)
    : 0;

  function onDeleteConfirmed() {
    const page = deleteCandidate;
    if (!page) return;
    setDeleteCandidate(null);
    startTransition(async () => {
      applyAction({ type: "delete_page", pageId: page.id });
      try {
        await deleteRoomWikiPage(page.id);
        if (selectedId === page.id) setRequestedId(null);
        router.refresh();
      } catch (err) {
        toast.error(
          actionErrorMessage(err, "Gagal menghapus halaman."));
        router.refresh();
      }
    });
  }

  /** Konflik: buang draft lokal dan pakai versi server (dipanggil dari PageEditor). */
  const resolveConflictReload = useCallback(
    (page: Page): SaveConflict | null => {
      const conflict = conflicts[page.id];
      if (!conflict) return null;
      revisionsRef.current.set(page.id, conflict.revision);
      latestTitleByPageIdRef.current.set(page.id, conflict.title);
      latestContentByPageIdRef.current.set(page.id, conflict.content);
      localStorage.removeItem(wikiDraftStorageKey(page.id));
      setSaveState({ pageId: page.id, status: "idle" });
      setConflicts((prev) => {
        const rest = { ...prev };
        delete rest[page.id];
        return rest;
      });
      router.refresh();
      return conflict;
    },
    [conflicts, router],
  );

  /** Konflik: timpa versi server dengan draft saya (versi lawan aman di riwayat). */
  const resolveConflictOverwrite = useCallback(
    (page: Page) => {
      const conflict = conflicts[page.id];
      if (!conflict) return;
      revisionsRef.current.set(page.id, conflict.revision);
      setConflicts((prev) => {
        const rest = { ...prev };
        delete rest[page.id];
        return rest;
      });
      persistPage(page, {});
    },
    [conflicts, persistPage],
  );

  const handleRestored = useCallback(
    (page: Page, restored: { title: string; content: string; revision: number }) => {
      revisionsRef.current.set(page.id, restored.revision);
      latestTitleByPageIdRef.current.set(page.id, restored.title);
      latestContentByPageIdRef.current.set(page.id, restored.content);
      localStorage.removeItem(wikiDraftStorageKey(page.id));
      setSaveState({ pageId: page.id, status: "idle" });
      router.refresh();
    },
    [router],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  function handleTreeDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activePage = pages.find((page) => page.id === active.id);
    const overPage = pages.find((page) => page.id === over.id);
    // Drag hanya menata ulang sibling; pindah induk tetap lewat dropdown halaman.
    if (!activePage || !overPage || activePage.parentId !== overPage.parentId) return;
    const siblingIds = pages
      .filter((page) => page.parentId === activePage.parentId)
      .map((page) => page.id);
    const from = siblingIds.indexOf(activePage.id);
    const to = siblingIds.indexOf(overPage.id);
    if (from === -1 || to === -1) return;
    const orderedIds = arrayMove(siblingIds, from, to);
    startTransition(async () => {
      applyAction({
        type: "reorder_siblings",
        parentId: activePage.parentId,
        orderedIds,
      });
      try {
        await reorderRoomWikiPages({
          viewId,
          parentId: activePage.parentId,
          orderedPageIds: orderedIds,
        });
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menyimpan urutan halaman."));
        router.refresh();
      }
    });
  }

  // Bersihkan semua timer saat unmount agar tidak ada save tertunda yang ngambang.
  useEffect(() => {
    const titleTimers = titleTimersRef.current;
    const contentTimers = contentTimersRef.current;
    return () => {
      for (const t of titleTimers.values()) clearTimeout(t);
      for (const t of contentTimers.values()) clearTimeout(t);
      titleTimers.clear();
      contentTimers.clear();
    };
  }, []);

  useEffect(() => {
    const retryDrafts = () => {
      for (const page of initialPages) {
        const draft = parseWikiDraft(
          localStorage.getItem(wikiDraftStorageKey(page.id)),
          page.id,
        );
        if (!draft) continue;
        latestTitleByPageIdRef.current.set(page.id, draft.title);
        latestContentByPageIdRef.current.set(page.id, draft.content);
        persistPage(page, { title: draft.title, content: draft.content });
      }
    };
    window.addEventListener("online", retryDrafts);
    return () => window.removeEventListener("online", retryDrafts);
  }, [initialPages, persistPage]);

  if (pages.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground flex flex-col items-center gap-3 py-12 text-center text-sm">
          <BookOpen className="text-muted-foreground/60 size-9" aria-hidden />
          <p className="max-w-sm">
            Wiki masih kosong. Mulai dari catatan keputusan rapat, brief singkat,
            atau “source of truth” yang sering ditanyakan tim.
          </p>
          <Button
            type="button"
            size="sm"
            onClick={() => onCreatePage()}
            className="gap-1.5"
          >
            <Plus className="size-3.5" aria-hidden />
            Buat halaman pertama
          </Button>
        </CardContent>
      </Card>
    );
  }

  const searching = searchQuery.trim().length > 0;

  return (
    <div className="grid gap-4 md:grid-cols-[260px_minmax(0,1fr)]">
      <Card className="md:sticky md:top-32 md:self-start">
        <CardContent className="space-y-1 p-2">
          <div className="flex items-center justify-between gap-1 px-1 pt-1">
            <span className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
              {pages.length} halaman
            </span>
            <button
              type="button"
              onClick={() => onCreatePage()}
              className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex size-7 items-center justify-center rounded-md transition-colors"
              aria-label="Tambah halaman"
              title="Tambah halaman"
            >
              <Plus className="size-3.5" aria-hidden />
            </button>
          </div>
          <div className="relative py-1">
            <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" aria-hidden />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Cari judul, isi, tag…"
              aria-label="Cari halaman Wiki"
              className="h-8 pl-8 text-xs"
            />
          </div>
          {searching ? (
            searchResults.length > 0 ? (
              <ul className="space-y-0.5">
                {searchResults.map((page) => (
                  <li key={page.id}>
                    <button
                      type="button"
                      onClick={() => {
                        selectPage(page.id);
                        setSearchQuery("");
                      }}
                      className={cn(
                        "w-full rounded-md px-2 py-1.5 text-left transition-colors",
                        selectedId === page.id
                          ? "bg-primary/10"
                          : "hover:bg-muted",
                      )}
                    >
                      <span className="block truncate text-sm font-medium">
                        {page.title || "Tanpa judul"}
                      </span>
                      <span className="text-muted-foreground line-clamp-2 text-[11px]">
                        {wikiSearchSnippet(page.content, searchQuery) || page.tags.join(" · ")}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground px-2 py-5 text-center text-xs">
                Tidak ada halaman yang cocok.
              </p>
            )
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleTreeDragEnd}
            >
              <SortableContext
                items={pageTree.map((node) => node.id)}
                strategy={verticalListSortingStrategy}
              >
                <ul role="tree" className="space-y-0.5">
                  {pageTree.map((node) => (
                    <WikiTreeItem
                      key={node.id}
                      node={node}
                      selectedId={selectedId}
                      collapsedIds={collapsedIds}
                      onToggleCollapsed={toggleCollapsed}
                      onSelect={selectPage}
                      onCreateChild={(parentId) => onCreatePage(parentId)}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>

      {selected ? (
        <PageEditor
          key={selected.id}
          roomId={roomId}
          viewId={viewId}
          page={selected}
          ancestors={ancestors}
          currentUserId={currentUserId}
          members={members}
          saveStatus={saveStatus}
          conflict={conflicts[selected.id] ?? null}
          onTitleChange={(v) => onTitleChange(selected, v)}
          onContentChange={(v) => onContentChange(selected, v)}
          pages={pages}
          backlinks={backlinks}
          onNavigatePage={selectPage}
          onCreateChild={() => onCreatePage(selected.id)}
          onOrganizationUpdated={() => router.refresh()}
          onDelete={() => setDeleteCandidate(selected)}
          onFlushSaves={() => flushPendingSaves(selected)}
          onConflictReload={() => resolveConflictReload(selected)}
          onConflictOverwrite={() => resolveConflictOverwrite(selected)}
          onRestored={(restored) => handleRestored(selected, restored)}
          autoStartEdit={pendingEditId === selected.id}
          onAutoEditHandled={() => setPendingEditId(null)}
        />
      ) : (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            Pilih halaman dari kiri untuk melihat isinya.
          </CardContent>
        </Card>
      )}

      <Dialog
        open={deleteCandidate != null}
        onOpenChange={(open) => {
          if (!open) setDeleteCandidate(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Hapus halaman Wiki?</DialogTitle>
            <DialogDescription>
              Halaman “{deleteCandidate?.title || "Tanpa judul"}” akan dihapus permanen
              beserta riwayat versi dan komentarnya.
              {deleteDescendants > 0
                ? ` ${deleteDescendants} sub-halaman di bawahnya tidak ikut terhapus dan akan pindah ke root Wiki.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setDeleteCandidate(null)}>
              Batal
            </Button>
            <Button type="button" variant="destructive" onClick={onDeleteConfirmed}>
              <Trash2 className="size-3.5" aria-hidden />
              Hapus halaman
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WikiTreeItem({
  node,
  selectedId,
  collapsedIds,
  onToggleCollapsed,
  onSelect,
  onCreateChild,
  depth = 0,
}: {
  node: WikiTreeNode<Page>;
  selectedId: string | null;
  collapsedIds: Set<string>;
  onToggleCollapsed: (pageId: string) => void;
  onSelect: (pageId: string) => void;
  onCreateChild: (parentId: string) => void;
  depth?: number;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: node.id });
  const collapsed = collapsedIds.has(node.id);
  const children = node.children ?? [];
  const tags = node.tags ?? [];
  const hasChildren = children.length > 0;
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      role="treeitem"
      aria-expanded={hasChildren ? !collapsed : undefined}
      aria-selected={selectedId === node.id}
      className={cn(isDragging && "relative z-10 opacity-70")}
    >
      <div
        className={cn(
          "group flex items-center rounded-md transition-colors",
          selectedId === node.id ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
        style={{ paddingLeft: `${depth * 12 + 2}px` }}
      >
        <button
          type="button"
          onClick={() => onToggleCollapsed(node.id)}
          disabled={!hasChildren}
          aria-label={collapsed ? "Buka halaman turunan" : "Tutup halaman turunan"}
          className="inline-flex size-6 shrink-0 items-center justify-center disabled:opacity-30"
        >
          <ChevronRight className={cn("size-3 transition-transform", hasChildren && !collapsed && "rotate-90")} />
        </button>
        <button
          type="button"
          onClick={() => onSelect(node.id)}
          className="flex min-w-0 flex-1 items-start gap-1.5 py-1.5 text-left text-sm"
        >
          <FileText className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{node.title || "Tanpa judul"}</span>
            {tags.length > 0 ? (
              <span className="text-muted-foreground block truncate text-[10px]">{tags.join(" · ")}</span>
            ) : null}
          </span>
        </button>
        <button
          type="button"
          onClick={() => onCreateChild(node.id)}
          className="hover:bg-background inline-flex size-6 shrink-0 items-center justify-center rounded opacity-0 group-hover:opacity-100 focus:opacity-100"
          aria-label={`Tambah halaman di bawah ${node.title}`}
          title="Tambah subhalaman"
        >
          <Plus className="size-3" />
        </button>
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="text-muted-foreground/70 hover:text-foreground mr-1 inline-flex size-6 shrink-0 cursor-grab touch-none items-center justify-center rounded opacity-0 group-hover:opacity-100 focus:opacity-100 active:cursor-grabbing"
          aria-label={`Seret untuk mengurutkan ${node.title || "halaman"}`}
          title="Seret untuk mengurutkan"
        >
          <GripVertical className="size-3.5" />
        </button>
      </div>
      {hasChildren && !collapsed ? (
        <SortableContext
          items={children.map((child) => child.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul role="group" className="space-y-0.5">
            {children.map((child) => (
              <WikiTreeItem
                key={child.id}
                node={child}
                selectedId={selectedId}
                collapsedIds={collapsedIds}
                onToggleCollapsed={onToggleCollapsed}
                onSelect={onSelect}
                onCreateChild={onCreateChild}
                depth={depth + 1}
              />
            ))}
          </ul>
        </SortableContext>
      ) : null}
    </li>
  );
}

type TocItem = { index: number; level: number; text: string };

/** Daftar isi otomatis dari heading, seperti panel outline Google Docs. */
function WikiToc({
  html,
  onJump,
}: {
  html: string;
  onJump: (index: number) => void;
}) {
  const [items, setItems] = useState<TocItem[]>([]);
  useEffect(() => {
    // Ditunda satu tick: DOMParser hanya ada di browser + hindari setState sinkron.
    const timeout = window.setTimeout(() => {
      const doc = new DOMParser().parseFromString(html, "text/html");
      setItems(
        Array.from(doc.body.querySelectorAll("h1, h2, h3")).map((el, index) => ({
          index,
          level: Number(el.tagName.slice(1)) || 1,
          text: el.textContent?.trim() || "(tanpa judul)",
        })),
      );
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [html]);

  if (items.length < 2) return null;
  return (
    <nav aria-label="Daftar isi halaman" className="text-xs">
      <p className="text-muted-foreground mb-2 flex items-center gap-1.5 font-semibold tracking-wide uppercase">
        <ListTree className="size-3.5" aria-hidden /> Daftar isi
      </p>
      <ul className="border-border space-y-1 border-l">
        {items.map((item) => (
          <li key={`${item.index}-${item.text}`}>
            <button
              type="button"
              onClick={() => onJump(item.index)}
              className={cn(
                "text-muted-foreground hover:text-foreground -ml-px block w-full truncate border-l border-transparent py-0.5 text-left transition-colors hover:border-primary",
                item.level === 1 && "pl-2 font-medium",
                item.level === 2 && "pl-4",
                item.level >= 3 && "pl-6",
              )}
              title={item.text}
            >
              {item.text}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function PageEditor({
  roomId,
  viewId,
  page,
  ancestors,
  currentUserId,
  members,
  pages,
  backlinks,
  saveStatus,
  conflict,
  onTitleChange,
  onContentChange,
  onDelete,
  onFlushSaves,
  onConflictReload,
  onConflictOverwrite,
  onRestored,
  onNavigatePage,
  onCreateChild,
  onOrganizationUpdated,
  autoStartEdit,
  onAutoEditHandled,
}: {
  roomId: string;
  viewId: string;
  page: Page;
  ancestors: Page[];
  currentUserId: string;
  members: RoomMemberAvatarUser[];
  pages: Page[];
  backlinks: Page[];
  saveStatus: SaveStatus;
  conflict: SaveConflict | null;
  onTitleChange: (next: string) => void;
  onContentChange: (next: string) => void;
  onDelete: () => void;
  onFlushSaves: () => void;
  onConflictReload: () => SaveConflict | null;
  onConflictOverwrite: () => void;
  onRestored: (restored: { title: string; content: string; revision: number }) => void;
  onNavigatePage: (pageId: string) => void;
  onCreateChild: () => void;
  onOrganizationUpdated: () => void;
  autoStartEdit: boolean;
  onAutoEditHandled: () => void;
}) {
  /** Input judul & konten lokal untuk unduhan (konten editor tidak re-render parent tiap ketik). */
  const [titleDraft, setTitleDraft] = useState(page.title);
  const [contentDraft, setContentDraft] = useState(page.content);
  const [editorGeneration, setEditorGeneration] = useState(0);
  const [recoveryCandidate, setRecoveryCandidate] = useState<WikiDraft | null>(null);
  const [tagsDraft, setTagsDraft] = useState((page.tags ?? []).join(", "));
  const [organizationPending, startOrganizationTransition] = useTransition();

  const [editing, setEditing] = useState(false);
  const [startingEdit, setStartingEdit] = useState(false);
  const [collaboration, setCollaboration] = useState<WikiCollaborationState | null>(null);
  const editingRef = useRef(editing);
  useEffect(() => {
    editingRef.current = editing;
  }, [editing]);

  const titleInputRef = useRef<HTMLInputElement>(null);
  const wantTitleFocusRef = useRef(false);
  const editorAreaRef = useRef<HTMLDivElement>(null);

  const startEditing = useCallback(async (): Promise<boolean> => {
    if (editingRef.current) return true;
    setStartingEdit(true);
    try {
      const state = await heartbeatRoomWikiPage(page.id, { requestLock: true });
      setCollaboration(state);
      if (!state.canEdit) {
        const owner = state.lock?.user;
        toast.error(
          owner
            ? `Halaman sedang diedit ${owner.name || owner.email}. Coba lagi nanti.`
            : "Halaman sedang diedit pengguna lain. Coba lagi nanti.",
        );
        return false;
      }
      setEditing(true);
      return true;
    } catch (error) {
      toast.error(actionErrorMessage(error, "Gagal mengambil lock edit."));
      return false;
    } finally {
      setStartingEdit(false);
    }
  }, [page.id]);

  const stopEditing = useCallback(() => {
    onFlushSaves();
    setEditing(false);
    // Optimistis: lock sudah kita lepas — jangan tampilkan status lock basi
    // sampai heartbeat berikutnya.
    setCollaboration((prev) => (prev ? { ...prev, canEdit: true, lock: null } : prev));
    void releaseRoomWikiLock(page.id).catch(() => undefined);
  }, [onFlushSaves, page.id]);

  // Lepas lock bila keluar halaman/unmount saat masih mode edit.
  useEffect(() => {
    return () => {
      if (editingRef.current) {
        void releaseRoomWikiLock(page.id).catch(() => undefined);
      }
    };
  }, [page.id]);

  const handleCollaborationChange = useCallback((state: WikiCollaborationState) => {
    setCollaboration(state);
    if (editingRef.current && !state.canEdit) {
      // Lock hangus (mis. laptop sleep) dan sudah diambil orang lain.
      setEditing(false);
      const owner = state.lock?.user;
      toast.error(
        owner
          ? `Lock edit berpindah ke ${owner.name || owner.email}. Halaman kembali ke mode baca.`
          : "Lock edit Anda berakhir. Halaman kembali ke mode baca.",
      );
    }
  }, []);

  // Halaman baru: langsung masuk mode edit + fokus & seleksi judul.
  const autoEditFiredRef = useRef(false);
  useEffect(() => {
    if (!autoStartEdit || autoEditFiredRef.current) return;
    wantTitleFocusRef.current = true;
    // Ref baru ditandai di dalam timeout supaya double-mount StrictMode
    // (mount→cleanup→mount) tidak menelan aksi sebelum sempat berjalan.
    const timeout = window.setTimeout(() => {
      autoEditFiredRef.current = true;
      onAutoEditHandled();
      void startEditing();
    }, 0);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStartEdit]);

  useEffect(() => {
    if (!editing || !wantTitleFocusRef.current) return;
    wantTitleFocusRef.current = false;
    const timeout = setTimeout(() => {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }, 0);
    return () => clearTimeout(timeout);
  }, [editing]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const draft = parseWikiDraft(localStorage.getItem(wikiDraftStorageKey(page.id)), page.id);
      if (draft && shouldRecoverWikiDraft(draft, page)) {
        setRecoveryCandidate(draft);
      }
    }, 0);
    return () => clearTimeout(timeout);
  }, [page]);

  // Draft bisa terhapus oleh autosave yang sukses setelah banner tampil —
  // tutup banner yang sudah basi agar tidak menawarkan pemulihan kosong.
  useEffect(() => {
    if (saveStatus !== "saved") return;
    const timeout = window.setTimeout(() => {
      setRecoveryCandidate((current) => {
        if (!current) return current;
        const draft = parseWikiDraft(localStorage.getItem(wikiDraftStorageKey(page.id)), page.id);
        return draft ? current : null;
      });
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [page.id, saveStatus]);

  function saveTags() {
    const tags = normalizeWikiTags(tagsDraft.split(","));
    setTagsDraft(tags.join(", "));
    if (tags.join("|") === (page.tags ?? []).join("|")) return;
    startOrganizationTransition(async () => {
      try {
        await updateRoomWikiPageOrganization({ pageId: page.id, tags });
        onOrganizationUpdated();
      } catch (error) {
        toast.error(actionErrorMessage(error, "Gagal menyimpan tag Wiki."));
      }
    });
  }

  function moveToParent(parentId: string | null) {
    startOrganizationTransition(async () => {
      try {
        await updateRoomWikiPageOrganization({ pageId: page.id, parentId });
        onOrganizationUpdated();
      } catch (error) {
        toast.error(actionErrorMessage(error, "Gagal memindahkan halaman."));
      }
    });
  }

  function applyServerVersion(next: { title: string; content: string }) {
    setTitleDraft(next.title);
    setContentDraft(next.content);
    setEditorGeneration((value) => value + 1);
  }

  const jumpToHeading = useCallback((index: number) => {
    const headings = editorAreaRef.current?.querySelectorAll(
      ".tiptap h1, .tiptap h2, .tiptap h3",
    );
    headings?.[index]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div className="bg-muted/40 border-border/60 min-w-0 rounded-xl border p-2 sm:p-4 lg:p-6">
      <div className="mx-auto flex max-w-[66rem] items-start justify-center gap-6">
        <Card className="w-full max-w-[52rem] min-w-0 shadow-md">
          <CardContent className="space-y-4 p-4 sm:p-8">
            {ancestors.length > 0 ? (
              <nav aria-label="Breadcrumb halaman" className="text-muted-foreground -mb-2 flex flex-wrap items-center gap-1 text-xs">
                {ancestors.map((ancestor) => (
                  <span key={ancestor.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onNavigatePage(ancestor.id)}
                      className="hover:text-foreground max-w-40 truncate underline-offset-2 hover:underline"
                    >
                      {ancestor.title || "Tanpa judul"}
                    </button>
                    <ChevronRight className="size-3 shrink-0" aria-hidden />
                  </span>
                ))}
                <span className="text-foreground max-w-40 truncate font-medium">
                  {titleDraft || "Tanpa judul"}
                </span>
              </nav>
            ) : null}

            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                {editing ? (
                  <Input
                    ref={titleInputRef}
                    value={titleDraft}
                    onChange={(e) => {
                      const v = e.target.value;
                      setTitleDraft(v);
                      onTitleChange(v);
                    }}
                    maxLength={160}
                    placeholder="Judul halaman"
                    aria-label="Judul halaman"
                    className="!h-auto border-0 bg-transparent px-0 py-1 !text-2xl font-semibold tracking-tight shadow-none ring-0 focus-visible:ring-0 sm:!text-3xl"
                  />
                ) : (
                  <h1 className="py-1 text-2xl font-semibold tracking-tight sm:text-3xl">
                    {titleDraft || "Tanpa judul"}
                  </h1>
                )}
                <p className="text-muted-foreground mt-0.5 text-xs">
                  Diperbarui {fmt(page.updatedAt)}
                  {page.updatedByName ? ` oleh ${page.updatedByName}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                {editing ? <SaveBadge status={saveStatus} /> : null}
                {editing ? (
                  <Button type="button" size="sm" onClick={stopEditing} className="gap-1.5">
                    <Check className="size-3.5" aria-hidden />
                    Selesai
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void startEditing()}
                    disabled={startingEdit}
                    className="gap-1.5"
                  >
                    {startingEdit ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    ) : (
                      <Pencil className="size-3.5" aria-hidden />
                    )}
                    Edit
                  </Button>
                )}
                <WikiCommentsSheet
                  pageId={page.id}
                  currentUserId={currentUserId}
                  members={members}
                />
                <WikiVersionHistory
                  pageId={page.id}
                  currentTitle={titleDraft}
                  currentContent={contentDraft}
                  restoreDisabled={saveStatus === "dirty" || saveStatus === "saving"}
                  onRestored={(restored) => {
                    applyServerVersion(restored);
                    onRestored(restored);
                  }}
                />
                <WikiPageDownloadMenu
                  roomId={roomId}
                  viewId={viewId}
                  pageId={page.id}
                  title={titleDraft}
                  contentHtml={contentDraft}
                />
                {editing ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Hapus halaman"
                    onClick={onDelete}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </Button>
                ) : null}
              </div>
            </div>

            <WikiPresenceRow
              pageId={page.id}
              currentUserId={currentUserId}
              editing={editing}
              collaboration={collaboration}
              onCollaborationChange={handleCollaborationChange}
            />

            {editing ? (
              <div className="border-border flex flex-wrap items-center gap-2 border-y py-2">
                <div className="relative min-w-48 flex-1">
                  <Tag className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" aria-hidden />
                  <Input
                    value={tagsDraft}
                    onChange={(event) => setTagsDraft(event.target.value)}
                    onBlur={saveTags}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        saveTags();
                        event.currentTarget.blur();
                      }
                    }}
                    placeholder="tag-satu, tag-dua"
                    aria-label="Tag halaman Wiki"
                    className="h-8 pl-8 text-xs"
                    disabled={organizationPending}
                  />
                </div>
                <select
                  value={page.parentId ?? ""}
                  onChange={(event) => moveToParent(event.target.value || null)}
                  disabled={organizationPending}
                  aria-label="Halaman induk"
                  className="border-input bg-background h-8 max-w-56 rounded-md border px-2 text-xs"
                >
                  <option value="">Root Wiki</option>
                  {pages.filter((candidate) => candidate.id !== page.id).map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.title || "Tanpa judul"}
                    </option>
                  ))}
                </select>
                <Button type="button" size="sm" variant="ghost" onClick={onCreateChild}>
                  <Plus className="size-3.5" /> Subhalaman
                </Button>
              </div>
            ) : (page.tags ?? []).length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <Tag className="text-muted-foreground size-3.5" aria-hidden />
                {(page.tags ?? []).map((tag) => (
                  <span
                    key={tag}
                    className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[11px]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}

            {conflict ? (
              <div className="border-amber-500/30 bg-amber-500/10 space-y-2 rounded-lg border px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">Halaman diubah pengguna lain</p>
                  <p className="text-muted-foreground text-xs">
                    Versi server diperbarui {fmt(conflict.updatedAt)}. Pilih versi mana yang dipakai —
                    draft Anda tetap aman sampai Anda memilih.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      const resolved = onConflictReload();
                      if (resolved) applyServerVersion(resolved);
                    }}
                  >
                    <RefreshCw className="size-3.5" aria-hidden />
                    Muat versi terbaru
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={onConflictOverwrite}>
                    Timpa dengan versi saya
                  </Button>
                </div>
              </div>
            ) : null}

            {recoveryCandidate ? (
              <div className="border-amber-500/30 bg-amber-500/10 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">Draft lokal yang belum tersimpan ditemukan</p>
                  <p className="text-muted-foreground text-xs">
                    Disimpan {fmt(recoveryCandidate.savedAt)}. Pilih pulihkan agar perubahan tidak hilang.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      localStorage.removeItem(wikiDraftStorageKey(page.id));
                      setRecoveryCandidate(null);
                    }}
                  >
                    Buang draft
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      void (async () => {
                        if (!(await startEditing())) return;
                        setTitleDraft(recoveryCandidate.title);
                        setContentDraft(recoveryCandidate.content);
                        setEditorGeneration((value) => value + 1);
                        onTitleChange(recoveryCandidate.title);
                        onContentChange(recoveryCandidate.content);
                        setRecoveryCandidate(null);
                      })();
                    }}
                  >
                    <RefreshCw className="size-3.5" />
                    Pulihkan draft
                  </Button>
                </div>
              </div>
            ) : null}

            <div ref={editorAreaRef}>
              <RichTextEditor
                key={editorGeneration}
                initialContent={contentDraft}
                editable={editing}
                onUpdate={(html) => {
                  setContentDraft(html);
                  onContentChange(html);
                }}
                onUploadFile={async (file) => {
                  const formData = new FormData();
                  formData.set("file", file);
                  return uploadRoomWikiAttachment(page.id, formData);
                }}
                wikiPages={pages.filter((candidate) => candidate.id !== page.id)}
                onNavigateWikiPage={onNavigatePage}
                placeholder="Tulis catatan, keputusan rapat, atau brief singkat di sini…"
              />
            </div>

            {backlinks.length > 0 ? (
              <div className="border-border border-t pt-4">
                <div className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
                  <Link2 className="size-3.5" /> {backlinks.length} backlink
                </div>
                <div className="flex flex-wrap gap-2">
                  {backlinks.map((backlink) => (
                    <button
                      key={backlink.id}
                      type="button"
                      onClick={() => onNavigatePage(backlink.id)}
                      className="bg-muted hover:bg-muted/80 rounded-md px-2.5 py-1.5 text-xs"
                    >
                      {backlink.title || "Tanpa judul"}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <aside className="sticky top-32 hidden w-52 shrink-0 self-start xl:block">
          <WikiToc html={contentDraft} onJump={jumpToHeading} />
        </aside>
      </div>
    </div>
  );
}

function SaveBadge({ status }: { status: SaveStatus }) {
  if (status === "dirty") {
    return (
      <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
        Perubahan belum disimpan
      </span>
    );
  }
  if (status === "saving") {
    return (
      <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
        <Loader2 className="size-3 animate-spin" aria-hidden />
        Menyimpan…
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
        <Check className="size-3 text-emerald-600 dark:text-emerald-400" aria-hidden />
        Tersimpan
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="text-destructive inline-flex items-center gap-1 text-xs">
        <CloudOff className="size-3" aria-hidden />
        Gagal · draft aman
      </span>
    );
  }
  if (status === "conflict") {
    return (
      <span className="text-amber-700 dark:text-amber-300 inline-flex items-center gap-1 text-xs">
        <RefreshCw className="size-3" aria-hidden />
        Konflik
      </span>
    );
  }
  return null;
}
