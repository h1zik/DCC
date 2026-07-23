"use client";

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
  Check,
  ChevronRight,
  CloudOff,
  CornerDownRight,
  FileText,
  Link2,
  Loader2,
  MoreHorizontal,
  NotebookPen,
  Plus,
  RefreshCw,
  Search,
  Tag,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  deletePersonalNote,
  listPersonalNoteVersions,
  restorePersonalNoteVersion,
  updatePersonalNoteOrganization,
  upsertPersonalNote,
} from "@/actions/personal-notes";
import { actionErrorMessage } from "@/lib/action-error-message";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RichTextEditorLazy as RichTextEditor } from "@/components/rich-text-editor-lazy";
import { WikiPageDownloadMenu } from "@/components/wiki-page-download-menu";
import { WikiVersionHistory } from "@/components/wiki-version-history";
import { cn } from "@/lib/utils";
import { personalNoteDownloadApiPath } from "@/lib/wiki-export";
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

type Note = {
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

type OptimisticAction = { type: "delete_note"; noteId: string };

function applyOptimistic(state: Note[], action: OptimisticAction): Note[] {
  switch (action.type) {
    case "delete_note":
      return state.filter((n) => n.id !== action.noteId);
    default:
      return state;
  }
}

export function NotesClient({ notes: initialNotes }: { notes: Note[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [notes, applyAction] = useOptimistic<Note[], OptimisticAction>(
    initialNotes,
    applyOptimistic,
  );

  const [requestedId, setRequestedId] = useState<string | null>(
    initialNotes[0]?.id ?? null,
  );
  const selectedId = useMemo(() => {
    if (requestedId && notes.some((n) => n.id === requestedId)) {
      return requestedId;
    }
    return notes[0]?.id ?? null;
  }, [notes, requestedId]);
  const selected = useMemo(
    () => notes.find((n) => n.id === selectedId) ?? null,
    [notes, selectedId],
  );

  const [saveState, setSaveState] = useState<{
    noteId: string | null;
    status: SaveStatus;
  }>({ noteId: null, status: "idle" });
  const saveStatus: SaveStatus =
    saveState.noteId === selectedId ? saveState.status : "idle";

  const titleTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const contentTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const latestTitleRef = useRef<Map<string, string>>(new Map());
  const latestContentRef = useRef<Map<string, string>>(new Map());
  const revisionsRef = useRef<Map<string, number>>(
    new Map(initialNotes.map((n) => [n.id, n.revision])),
  );
  const saveChainsRef = useRef<Map<string, Promise<void>>>(new Map());

  const [searchQuery, setSearchQuery] = useState("");
  const visibleNotes = useMemo(
    () => searchWikiPages(notes, searchQuery),
    [notes, searchQuery],
  );
  const noteTree = useMemo(() => buildWikiTree(visibleNotes), [visibleNotes]);
  const backlinks = useMemo(
    () => (selected ? findWikiBacklinks(notes, selected.id) : []),
    [notes, selected],
  );

  const persistNote = useCallback(
    (note: Note, patch: { title?: string; content?: string }) => {
      const resolvedTitle =
        patch.title ?? latestTitleRef.current.get(note.id) ?? note.title;
      const resolvedContent =
        patch.content ?? latestContentRef.current.get(note.id) ?? note.content;
      const snapshot = { title: resolvedTitle, content: resolvedContent };
      const previous = saveChainsRef.current.get(note.id) ?? Promise.resolve();
      const next = previous
        .catch(() => undefined)
        .then(async () => {
          setSaveState({ noteId: note.id, status: "saving" });
          try {
            const result = await upsertPersonalNote({
              id: note.id,
              title: snapshot.title,
              content: snapshot.content,
              baseRevision: revisionsRef.current.get(note.id) ?? note.revision,
            });
            if (result.conflict) {
              setSaveState({ noteId: note.id, status: "conflict" });
              toast.error(
                "Catatan berubah di tab lain. Draft lokal tetap aman — muat ulang halaman.",
              );
              return;
            }
            revisionsRef.current.set(note.id, result.revision);
            const latestTitle =
              latestTitleRef.current.get(note.id) ?? note.title;
            const latestContent =
              latestContentRef.current.get(note.id) ?? note.content;
            if (
              latestTitle === snapshot.title &&
              latestContent === snapshot.content
            ) {
              localStorage.removeItem(wikiDraftStorageKey(note.id));
              setSaveState({ noteId: note.id, status: "saved" });
            }
          } catch (err) {
            setSaveState({ noteId: note.id, status: "error" });
            toast.error(
              actionErrorMessage(
                err,
                "Gagal menyimpan catatan. Draft lokal tetap aman.",
              ),
            );
          }
        });
      saveChainsRef.current.set(note.id, next);
    },
    [],
  );

  const writeDraft = useCallback((note: Note, title: string, content: string) => {
    try {
      localStorage.setItem(
        wikiDraftStorageKey(note.id),
        JSON.stringify({
          pageId: note.id,
          title,
          content,
          baseRevision: revisionsRef.current.get(note.id) ?? note.revision,
          savedAt: new Date().toISOString(),
        } satisfies WikiDraft),
      );
    } catch {
      // localStorage bisa ditolak browser; auto-save server tetap jalan.
    }
  }, []);

  const onTitleChange = useCallback(
    (note: Note, nextTitle: string) => {
      latestTitleRef.current.set(note.id, nextTitle);
      setSaveState({ noteId: note.id, status: "dirty" });
      writeDraft(
        note,
        nextTitle,
        latestContentRef.current.get(note.id) ?? note.content,
      );
      const existing = titleTimersRef.current.get(note.id);
      if (existing) clearTimeout(existing);
      if (!nextTitle.trim()) return;
      const t = setTimeout(() => {
        titleTimersRef.current.delete(note.id);
        persistNote(note, { title: nextTitle.trim() });
      }, AUTOSAVE_DELAY_MS);
      titleTimersRef.current.set(note.id, t);
    },
    [persistNote, writeDraft],
  );

  const onContentChange = useCallback(
    (note: Note, nextContent: string) => {
      latestContentRef.current.set(note.id, nextContent);
      if (!latestTitleRef.current.has(note.id)) {
        latestTitleRef.current.set(note.id, note.title);
      }
      setSaveState({ noteId: note.id, status: "dirty" });
      writeDraft(
        note,
        latestTitleRef.current.get(note.id) ?? note.title,
        nextContent,
      );
      const existing = contentTimersRef.current.get(note.id);
      if (existing) clearTimeout(existing);
      const t = setTimeout(() => {
        contentTimersRef.current.delete(note.id);
        persistNote(note, { content: nextContent });
      }, AUTOSAVE_DELAY_MS);
      contentTimersRef.current.set(note.id, t);
    },
    [persistNote, writeDraft],
  );

  function onCreateNote(parentId: string | null = null) {
    startTransition(async () => {
      try {
        const res = await upsertPersonalNote({
          title: "Catatan baru",
          content: "",
          parentId,
        });
        if (!res.conflict && res.id) setRequestedId(res.id);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal membuat catatan."));
      }
    });
  }

  function onDeleteNote(note: Note) {
    if (!confirm(`Hapus catatan “${note.title}”?`)) return;
    startTransition(async () => {
      applyAction({ type: "delete_note", noteId: note.id });
      try {
        await deletePersonalNote(note.id);
        localStorage.removeItem(wikiDraftStorageKey(note.id));
        if (selectedId === note.id) setRequestedId(null);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menghapus catatan."));
        router.refresh();
      }
    });
  }

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

  // Saat koneksi kembali, flush ulang draft lokal yang belum tersimpan.
  useEffect(() => {
    const retryDrafts = () => {
      for (const note of initialNotes) {
        const draft = parseWikiDraft(
          localStorage.getItem(wikiDraftStorageKey(note.id)),
          note.id,
        );
        if (!draft) continue;
        latestTitleRef.current.set(note.id, draft.title);
        latestContentRef.current.set(note.id, draft.content);
        persistNote(note, { title: draft.title, content: draft.content });
      }
    };
    window.addEventListener("online", retryDrafts);
    return () => window.removeEventListener("online", retryDrafts);
  }, [initialNotes, persistNote]);

  if (notes.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground flex flex-col items-center gap-3 py-12 text-center text-sm">
          <NotebookPen className="text-muted-foreground/60 size-9" aria-hidden />
          <p className="max-w-sm">
            Belum ada catatan. Tulis apa pun — jurnal, ide, draf — hanya kamu
            yang bisa membacanya.
          </p>
          <Button
            type="button"
            size="sm"
            onClick={() => onCreateNote()}
            className="gap-1.5"
          >
            <Plus className="size-3.5" aria-hidden />
            Buat catatan pertama
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
              {notes.length} catatan
            </span>
            <button
              type="button"
              onClick={() => onCreateNote()}
              className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex size-7 items-center justify-center rounded-md transition-colors"
              aria-label="Tambah catatan"
              title="Tambah catatan"
            >
              <Plus className="size-3.5" aria-hidden />
            </button>
          </div>
          <div className="relative py-1">
            <Search
              className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
              aria-hidden
            />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari judul, isi, tag…"
              aria-label="Cari catatan"
              className="h-8 pl-8 text-xs"
            />
          </div>
          {noteTree.length > 0 ? (
            <ul role="tree" className="space-y-0.5">
              {noteTree.map((node) => (
                <NoteTreeItem
                  key={node.id}
                  node={node}
                  selectedId={selectedId}
                  onSelect={setRequestedId}
                  onCreateChild={(parentId) => onCreateNote(parentId)}
                />
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground px-2 py-5 text-center text-xs">
              Tidak ada catatan yang cocok.
            </p>
          )}
        </CardContent>
      </Card>

      {selected ? (
        <NoteEditor
          key={selected.id}
          note={selected}
          notes={notes}
          backlinks={backlinks}
          saveStatus={saveStatus}
          onTitleChange={(v) => onTitleChange(selected, v)}
          onContentChange={(v) => onContentChange(selected, v)}
          onNavigateNote={setRequestedId}
          onCreateChild={() => onCreateNote(selected.id)}
          onOrganizationUpdated={() => router.refresh()}
          onDelete={() => onDeleteNote(selected)}
          onRestored={() => {
            localStorage.removeItem(wikiDraftStorageKey(selected.id));
            router.refresh();
          }}
        />
      ) : (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            Pilih catatan dari kiri untuk melihat isinya.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function NoteTreeItem({
  node,
  selectedId,
  onSelect,
  onCreateChild,
  depth = 0,
}: {
  node: WikiTreeNode<Note>;
  selectedId: string | null;
  onSelect: (noteId: string) => void;
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
          selectedId === node.id
            ? "bg-primary/10 text-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
        style={{ paddingLeft: `${depth * 12 + 2}px` }}
      >
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          disabled={!hasChildren}
          aria-label={collapsed ? "Buka catatan turunan" : "Tutup catatan turunan"}
          className="inline-flex size-6 shrink-0 items-center justify-center disabled:opacity-30"
        >
          <ChevronRight
            className={cn(
              "size-3 transition-transform",
              hasChildren && !collapsed && "rotate-90",
            )}
          />
        </button>
        <button
          type="button"
          onClick={() => onSelect(node.id)}
          className="flex min-w-0 flex-1 items-start gap-1.5 py-1.5 text-left text-sm"
        >
          <FileText className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">
              {node.title || "Tanpa judul"}
            </span>
            {tags.length > 0 ? (
              <span className="text-muted-foreground block truncate text-[10px]">
                {tags.join(" · ")}
              </span>
            ) : null}
          </span>
        </button>
        <button
          type="button"
          onClick={() => onCreateChild(node.id)}
          className="hover:bg-background mr-1 inline-flex size-6 shrink-0 items-center justify-center rounded opacity-0 group-hover:opacity-100 focus:opacity-100"
          aria-label={`Tambah catatan di bawah ${node.title}`}
          title="Tambah subcatatan"
        >
          <Plus className="size-3" />
        </button>
      </div>
      {hasChildren && !collapsed ? (
        <ul role="group" className="space-y-0.5">
          {children.map((child) => (
            <NoteTreeItem
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

function NoteEditor({
  note,
  notes,
  backlinks,
  saveStatus,
  onTitleChange,
  onContentChange,
  onDelete,
  onRestored,
  onNavigateNote,
  onCreateChild,
  onOrganizationUpdated,
}: {
  note: Note;
  notes: Note[];
  backlinks: Note[];
  saveStatus: SaveStatus;
  onTitleChange: (next: string) => void;
  onContentChange: (next: string) => void;
  onDelete: () => void;
  onRestored: () => void;
  onNavigateNote: (noteId: string) => void;
  onCreateChild: () => void;
  onOrganizationUpdated: () => void;
}) {
  const [titleDraft, setTitleDraft] = useState(note.title);
  const [contentDraft, setContentDraft] = useState(note.content);
  const [editorGeneration, setEditorGeneration] = useState(0);
  const [recoveryCandidate, setRecoveryCandidate] = useState<WikiDraft | null>(
    null,
  );
  const [tagsDraft, setTagsDraft] = useState((note.tags ?? []).join(", "));
  const [organizationPending, startOrganizationTransition] = useTransition();

  useEffect(() => {
    const timeout = setTimeout(() => {
      const draft = parseWikiDraft(
        localStorage.getItem(wikiDraftStorageKey(note.id)),
        note.id,
      );
      if (draft && shouldRecoverWikiDraft(draft, note)) {
        setRecoveryCandidate(draft);
      }
    }, 0);
    return () => clearTimeout(timeout);
  }, [note]);

  function saveTags() {
    const tags = normalizeWikiTags(tagsDraft.split(","));
    setTagsDraft(tags.join(", "));
    if (tags.join("|") === (note.tags ?? []).join("|")) return;
    startOrganizationTransition(async () => {
      try {
        await updatePersonalNoteOrganization({ id: note.id, tags });
        onOrganizationUpdated();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menyimpan tag."));
      }
    });
  }

  function moveToParent(parentId: string | null) {
    startOrganizationTransition(async () => {
      try {
        await updatePersonalNoteOrganization({ id: note.id, parentId });
        onOrganizationUpdated();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal memindahkan catatan."));
      }
    });
  }

  return (
    <Card className="hover:!translate-y-0">
      <CardContent className="p-0">
        {/* Chrome atas: satu baris tipis — status simpan di kiri, aksi di kanan */}
        <div className="flex items-center justify-between gap-2 px-4 pt-3 sm:px-8">
          <SaveBadge status={saveStatus} />
          <div className="flex shrink-0 items-center gap-0.5">
            <WikiVersionHistory
              pageId={note.id}
              currentTitle={titleDraft}
              currentContent={contentDraft}
              restoreDisabled={saveStatus === "dirty" || saveStatus === "saving"}
              onRestored={onRestored}
              listVersions={listPersonalNoteVersions}
              restoreVersion={restorePersonalNoteVersion}
            />
            <WikiPageDownloadMenu
              title={titleDraft}
              contentHtml={contentDraft}
              buildServerApiPath={(format) => personalNoteDownloadApiPath(note.id, format)}
            />
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Aksi catatan lainnya"
                  >
                    <MoreHorizontal className="size-3.5" aria-hidden />
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={onCreateChild}>
                  <Plus /> Subcatatan baru
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={onDelete}>
                  <Trash2 /> Hapus catatan
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Kolom konten terpusat ala Notion */}
        <div className="mx-auto w-full max-w-4xl px-4 pb-6 sm:px-8">
          <Input
            value={titleDraft}
            onChange={(e) => {
              const v = e.target.value;
              setTitleDraft(v);
              onTitleChange(v);
            }}
            maxLength={160}
            placeholder="Tanpa judul"
            aria-label="Judul catatan"
            className="!h-auto border-0 bg-transparent px-0 py-1 text-3xl font-bold tracking-tight shadow-none ring-0 placeholder:text-muted-foreground/40 focus-visible:ring-0 sm:text-4xl"
          />

          {/* Baris properti: kalem tanpa border, kontrol baru terlihat saat hover/focus */}
          <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
            <span className="whitespace-nowrap py-1">Diperbarui {fmt(note.updatedAt)}</span>
            <span aria-hidden className="text-border">·</span>
            <div className="relative flex items-center">
              <Tag className="pointer-events-none absolute left-1.5 size-3" aria-hidden />
              <input
                value={tagsDraft}
                onChange={(e) => setTagsDraft(e.target.value)}
                onBlur={saveTags}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    saveTags();
                    e.currentTarget.blur();
                  }
                }}
                placeholder="Tambah tag…"
                aria-label="Tag catatan"
                disabled={organizationPending}
                className="hover:bg-muted focus:bg-muted placeholder:text-muted-foreground/60 h-7 w-44 rounded-md bg-transparent pl-6 pr-2 text-xs outline-none transition-colors disabled:cursor-not-allowed"
              />
            </div>
            <span aria-hidden className="text-border">·</span>
            <div className="relative flex items-center">
              <CornerDownRight className="pointer-events-none absolute left-1.5 size-3" aria-hidden />
              <select
                value={note.parentId ?? ""}
                onChange={(e) => moveToParent(e.target.value || null)}
                disabled={organizationPending}
                aria-label="Catatan induk"
                title="Catatan induk"
                className="hover:bg-muted h-7 max-w-52 cursor-pointer appearance-none rounded-md border-0 bg-transparent pl-6 pr-2 text-xs outline-none transition-colors disabled:cursor-not-allowed"
              >
                <option value="">Root</option>
                {notes
                  .filter((candidate) => candidate.id !== note.id)
                  .map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.title || "Tanpa judul"}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {recoveryCandidate ? (
            <div className="border-amber-500/25 bg-amber-500/10 mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border px-3 py-1.5 text-xs">
              <span className="font-medium text-amber-800 dark:text-amber-200">
                Draft lokal ditemukan ({fmt(recoveryCandidate.savedAt)})
              </span>
              <span className="text-muted-foreground">Pulihkan agar perubahan tidak hilang.</span>
              <span className="ml-auto flex items-center gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs"
                  onClick={() => {
                    localStorage.removeItem(wikiDraftStorageKey(note.id));
                    setRecoveryCandidate(null);
                  }}
                >
                  Buang
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => {
                    setTitleDraft(recoveryCandidate.title);
                    setContentDraft(recoveryCandidate.content);
                    setEditorGeneration((v) => v + 1);
                    onTitleChange(recoveryCandidate.title);
                    onContentChange(recoveryCandidate.content);
                    setRecoveryCandidate(null);
                  }}
                >
                  <RefreshCw className="size-3" />
                  Pulihkan
                </Button>
              </span>
            </div>
          ) : null}

          <div className="mt-3">
            <RichTextEditor
              key={editorGeneration}
              initialContent={contentDraft}
              onUpdate={(html) => {
                setContentDraft(html);
                onContentChange(html);
              }}
              onUploadFile={async (file) => {
                const formData = new FormData();
                formData.set("file", file);
                formData.set("source", "note");
                const res = await fetch("/api/personal/files", {
                  method: "POST",
                  body: formData,
                });
                if (!res.ok) {
                  throw new Error((await res.text()) || "Gagal mengunggah file.");
                }
                const data = (await res.json()) as {
                  id: string;
                  fileName: string;
                  mimeType: string;
                  size: number;
                };
                return {
                  url: `/api/personal/files/${data.id}/download`,
                  name: data.fileName,
                  mimeType: data.mimeType,
                  size: data.size,
                };
              }}
              wikiPages={notes.filter((candidate) => candidate.id !== note.id)}
              onNavigateWikiPage={onNavigateNote}
              placeholder="Tulis catatan pribadimu, ketik / untuk perintah…"
              showTableOfContents
              showToolbar={false}
            />
          </div>

          {backlinks.length > 0 ? (
            <div className="border-border mt-4 border-t pt-4">
              <div className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
                <Link2 className="size-3.5" /> {backlinks.length} backlink
              </div>
              <div className="flex flex-wrap gap-2">
                {backlinks.map((backlink) => (
                  <button
                    key={backlink.id}
                    type="button"
                    onClick={() => onNavigateNote(backlink.id)}
                    className="bg-muted hover:bg-muted/80 rounded-md px-2.5 py-1.5 text-xs"
                  >
                    {backlink.title || "Tanpa judul"}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
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
        <Check
          className="size-3 text-emerald-600 dark:text-emerald-400"
          aria-hidden
        />
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
      <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300">
        <RefreshCw className="size-3" aria-hidden />
        Konflik · muat ulang
      </span>
    );
  }
  return null;
}
