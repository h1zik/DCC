"use client";
import { actionErrorMessage } from "@/lib/action-error-message";

import { useRouter } from "next/navigation";
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
  BookOpen,
  Check,
  ChevronRight,
  CloudOff,
  FileText,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Tag,
  Trash2,
} from "lucide-react";
import {
  deleteRoomWikiPage,
  uploadRoomWikiAttachment,
  upsertRoomWikiPage,
  updateRoomWikiPageOrganization,
} from "@/actions/room-view-wiki";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RichTextEditorLazy as RichTextEditor } from "@/components/rich-text-editor-lazy";
import { WikiPageDownloadMenu } from "@/components/wiki-page-download-menu";
import { WikiVersionHistory } from "@/components/wiki-version-history";
import { WikiCollaborationPanel } from "@/components/wiki-collaboration-panel";
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
};

type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error" | "conflict";

const AUTOSAVE_DELAY_MS = 800;

function fmt(iso: string) {
  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type OptimisticAction = { type: "delete_page"; pageId: string };

function applyOptimistic(state: Page[], action: OptimisticAction): Page[] {
  switch (action.type) {
    case "delete_page":
      return state.filter((p) => p.id !== action.pageId);
    default:
      return state;
  }
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
  const [, startTransition] = useTransition();
  const [pages, applyAction] = useOptimistic<Page[], OptimisticAction>(
    initialPages,
    applyOptimistic,
  );

  const [requestedId, setRequestedId] = useState<string | null>(
    initialPages[0]?.id ?? null,
  );

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

  // Status auto-save di-scope per halaman supaya tidak perlu mereset via effect
  // saat berpindah halaman — kita derive `saveStatus` dari `selectedId`.
  const [saveState, setSaveState] = useState<{
    pageId: string | null;
    status: SaveStatus;
  }>({ pageId: null, status: "idle" });
  const saveStatus: SaveStatus =
    saveState.pageId === selectedId ? saveState.status : "idle";

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
  const visiblePages = useMemo(
    () => searchWikiPages(pages, searchQuery),
    [pages, searchQuery],
  );
  const pageTree = useMemo(() => buildWikiTree(visiblePages), [visiblePages]);
  const backlinks = useMemo(
    () => (selected ? findWikiBacklinks(pages, selected.id) : []),
    [pages, selected],
  );
  const saveChainsRef = useRef<Map<string, Promise<void>>>(new Map());

  const persistPage = useCallback(
    (page: Page, patch: { title?: string; content?: string }) => {
      const resolvedTitle =
        patch.title ??
        latestTitleByPageIdRef.current.get(page.id) ??
        page.title;
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
              toast.error("Halaman diubah pengguna lain. Draft lokal tetap aman.");
              return;
            }
            revisionsRef.current.set(page.id, result.revision);
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

  function onCreatePage(parentId: string | null = null) {
    startTransition(async () => {
      try {
        const res = await upsertRoomWikiPage({
          viewId,
          title: "Halaman baru",
          content: "",
          parentId,
        });
        if (res?.id) setRequestedId(res.id);
        router.refresh();
      } catch (err) {
        toast.error(
          actionErrorMessage(err, "Gagal membuat halaman."));
      }
    });
  }

  function onDeletePage(page: Page) {
    if (!confirm(`Hapus halaman “${page.title}”?`)) return;
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

  return (
    <div className="grid gap-4 md:grid-cols-[260px_1fr]">
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
          {pageTree.length > 0 ? (
            <ul role="tree" className="space-y-0.5">
              {pageTree.map((node) => (
                <WikiTreeItem
                  key={node.id}
                  node={node}
                  selectedId={selectedId}
                  onSelect={setRequestedId}
                  onCreateChild={(parentId) => onCreatePage(parentId)}
                />
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground px-2 py-5 text-center text-xs">Tidak ada halaman yang cocok.</p>
          )}
        </CardContent>
      </Card>

      {selected ? (
        <PageEditor
          key={selected.id}
          roomId={roomId}
          viewId={viewId}
          page={selected}
          currentUserId={currentUserId}
          members={members}
          saveStatus={saveStatus}
          onTitleChange={(v) => onTitleChange(selected, v)}
          onContentChange={(v) => onContentChange(selected, v)}
          pages={pages}
          backlinks={backlinks}
          onNavigatePage={setRequestedId}
          onCreateChild={() => onCreatePage(selected.id)}
          onOrganizationUpdated={() => router.refresh()}
          onDelete={() => onDeletePage(selected)}
          onRestored={() => {
            localStorage.removeItem(wikiDraftStorageKey(selected.id));
            router.refresh();
          }}
        />
      ) : (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            Pilih halaman dari kiri untuk melihat isinya.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function WikiTreeItem({
  node,
  selectedId,
  onSelect,
  onCreateChild,
  depth = 0,
}: {
  node: WikiTreeNode<Page>;
  selectedId: string | null;
  onSelect: (pageId: string) => void;
  onCreateChild: (parentId: string) => void;
  depth?: number;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const children = node.children ?? [];
  const tags = node.tags ?? [];
  const hasChildren = children.length > 0;
  return (
    <li
      role="treeitem"
      aria-expanded={hasChildren ? !collapsed : undefined}
      aria-selected={selectedId === node.id}
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
          onClick={() => setCollapsed((value) => !value)}
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
          className="hover:bg-background mr-1 inline-flex size-6 shrink-0 items-center justify-center rounded opacity-0 group-hover:opacity-100 focus:opacity-100"
          aria-label={`Tambah halaman di bawah ${node.title}`}
          title="Tambah subhalaman"
        >
          <Plus className="size-3" />
        </button>
      </div>
      {hasChildren && !collapsed ? (
        <ul role="group" className="space-y-0.5">
          {children.map((child) => (
            <WikiTreeItem
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              onCreateChild={onCreateChild}
              depth={depth + 1}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function PageEditor({
  roomId,
  viewId,
  page,
  currentUserId,
  members,
  pages,
  backlinks,
  saveStatus,
  onTitleChange,
  onContentChange,
  onDelete,
  onRestored,
  onNavigatePage,
  onCreateChild,
  onOrganizationUpdated,
}: {
  roomId: string;
  viewId: string;
  page: Page;
  currentUserId: string;
  members: RoomMemberAvatarUser[];
  pages: Page[];
  backlinks: Page[];
  saveStatus: SaveStatus;
  onTitleChange: (next: string) => void;
  onContentChange: (next: string) => void;
  onDelete: () => void;
  onRestored: () => void;
  onNavigatePage: (pageId: string) => void;
  onCreateChild: () => void;
  onOrganizationUpdated: () => void;
}) {
  /** Input judul & konten lokal untuk unduhan (konten editor tidak re-render parent tiap ketik). */
  const [titleDraft, setTitleDraft] = useState(page.title);
  const [contentDraft, setContentDraft] = useState(page.content);
  const [editorGeneration, setEditorGeneration] = useState(0);
  const [recoveryCandidate, setRecoveryCandidate] = useState<WikiDraft | null>(null);
  const [tagsDraft, setTagsDraft] = useState((page.tags ?? []).join(", "));
  const [organizationPending, startOrganizationTransition] = useTransition();
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const draft = parseWikiDraft(localStorage.getItem(wikiDraftStorageKey(page.id)), page.id);
      if (draft && shouldRecoverWikiDraft(draft, page)) {
        setRecoveryCandidate(draft);
      }
    }, 0);
    return () => clearTimeout(timeout);
  }, [page]);

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

  return (
    <Card>
      <CardContent className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <Input
              value={titleDraft}
              disabled={!canEdit}
              onChange={(e) => {
                const v = e.target.value;
                setTitleDraft(v);
                onTitleChange(v);
              }}
              maxLength={160}
              placeholder="Judul halaman"
              aria-label="Judul halaman"
              className="!h-auto border-0 bg-transparent px-0 py-1 text-2xl font-semibold tracking-tight shadow-none ring-0 focus-visible:ring-0 sm:text-3xl"
            />
            <p className="text-muted-foreground mt-0.5 text-xs">
              Diperbarui {fmt(page.updatedAt)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <WikiVersionHistory
              pageId={page.id}
              currentTitle={titleDraft}
              currentContent={contentDraft}
              restoreDisabled={!canEdit || saveStatus === "dirty" || saveStatus === "saving"}
              onRestored={onRestored}
            />
            <WikiPageDownloadMenu
              roomId={roomId}
              viewId={viewId}
              pageId={page.id}
              title={titleDraft}
              contentHtml={contentDraft}
            />
            <SaveBadge status={saveStatus} />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Hapus halaman"
              onClick={onDelete}
              disabled={!canEdit}
            >
              <Trash2 className="size-3.5" aria-hidden />
            </Button>
          </div>
        </div>

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
              disabled={organizationPending || !canEdit}
            />
          </div>
          <select
            value={page.parentId ?? ""}
            onChange={(event) => moveToParent(event.target.value || null)}
            disabled={organizationPending || !canEdit}
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
          <Button type="button" size="sm" variant="ghost" onClick={onCreateChild} disabled={!canEdit}>
            <Plus className="size-3.5" /> Subhalaman
          </Button>
        </div>

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
                  setTitleDraft(recoveryCandidate.title);
                  setContentDraft(recoveryCandidate.content);
                  setEditorGeneration((value) => value + 1);
                  onTitleChange(recoveryCandidate.title);
                  onContentChange(recoveryCandidate.content);
                  setRecoveryCandidate(null);
                }}
              >
                <RefreshCw className="size-3.5" />
                Pulihkan draft
              </Button>
            </div>
          </div>
        ) : null}

        <RichTextEditor
          key={editorGeneration}
          initialContent={contentDraft}
          editable={canEdit}
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

        <WikiCollaborationPanel
          pageId={page.id}
          currentUserId={currentUserId}
          members={members}
          onEditableChange={setCanEdit}
        />
      </CardContent>
    </Card>
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
        Konflik · muat ulang
      </span>
    );
  }
  return null;
}
