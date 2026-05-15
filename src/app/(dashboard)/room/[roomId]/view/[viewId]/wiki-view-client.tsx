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
  FileText,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import {
  deleteRoomWikiPage,
  upsertRoomWikiPage,
} from "@/actions/room-view-wiki";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/rich-text-editor";
import { cn } from "@/lib/utils";

type Page = {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

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
  viewId,
  pages: initialPages,
}: {
  viewId: string;
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

  /** Judul terbaru per halaman (dari input lokal), dipakai saat auto-save konten agar judul tidak tertimpa nilai props lama. */
  const latestTitleByPageIdRef = useRef<Map<string, string>>(new Map());

  const persistPage = useCallback(
    (page: Page, patch: { title?: string; content?: string }) => {
      const resolvedTitle =
        patch.title ??
        latestTitleByPageIdRef.current.get(page.id) ??
        page.title;
      setSaveState({ pageId: page.id, status: "saving" });
      startTransition(async () => {
        try {
          await upsertRoomWikiPage({
            id: page.id,
            viewId,
            title: resolvedTitle,
            content: patch.content ?? page.content,
          });
          setSaveState({ pageId: page.id, status: "saved" });
          router.refresh();
        } catch (err) {
          setSaveState({ pageId: page.id, status: "error" });
          toast.error(
            actionErrorMessage(err, "Gagal menyimpan halaman."));
        }
      });
    },
    [router, viewId],
  );

  // Judul: JANGAN pakai useOptimistic + startTransition sinkron — pola itu
  // membuat state langsung revert ke props server sehingga input terkontrol
  // “kedip” / huruf hilang. Input judul pakai state lokal di PageEditor.
  const onTitleChange = useCallback(
    (page: Page, nextTitle: string) => {
      latestTitleByPageIdRef.current.set(page.id, nextTitle);
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
      if (!latestTitleByPageIdRef.current.has(page.id)) {
        latestTitleByPageIdRef.current.set(page.id, page.title);
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

  function onCreatePage() {
    startTransition(async () => {
      try {
        const res = await upsertRoomWikiPage({
          viewId,
          title: "Halaman baru",
          content: "",
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
            onClick={onCreatePage}
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
              onClick={onCreatePage}
              className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex size-7 items-center justify-center rounded-md transition-colors"
              aria-label="Tambah halaman"
              title="Tambah halaman"
            >
              <Plus className="size-3.5" aria-hidden />
            </button>
          </div>
          <ul role="list" className="space-y-0.5">
            {pages.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setRequestedId(p.id)}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                    selectedId === p.id
                      ? "bg-primary/10 text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <FileText
                    className="mt-0.5 size-3.5 shrink-0"
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {p.title || "Tanpa judul"}
                    </span>
                    <span className="text-muted-foreground block truncate text-[10px]">
                      {fmt(p.updatedAt)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {selected ? (
        <PageEditor
          key={selected.id}
          page={selected}
          saveStatus={saveStatus}
          onTitleChange={(v) => onTitleChange(selected, v)}
          onContentChange={(v) => onContentChange(selected, v)}
          onDelete={() => onDeletePage(selected)}
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

function PageEditor({
  page,
  saveStatus,
  onTitleChange,
  onContentChange,
  onDelete,
}: {
  page: Page;
  saveStatus: SaveStatus;
  onTitleChange: (next: string) => void;
  onContentChange: (next: string) => void;
  onDelete: () => void;
}) {
  /** Input judul tidak boleh purely controlled oleh props (useOptimistic revert). */
  const [titleDraft, setTitleDraft] = useState(page.title);
  useEffect(() => {
    setTitleDraft(page.title);
  }, [page.id]);

  return (
    <Card>
      <CardContent className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <Input
              value={titleDraft}
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
            <SaveBadge status={saveStatus} />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Hapus halaman"
              onClick={onDelete}
            >
              <Trash2 className="size-3.5" aria-hidden />
            </Button>
          </div>
        </div>

        <RichTextEditor
          initialContent={page.content}
          onUpdate={onContentChange}
          placeholder="Tulis catatan, keputusan rapat, atau brief singkat di sini…"
        />
      </CardContent>
    </Card>
  );
}

function SaveBadge({ status }: { status: SaveStatus }) {
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
        Gagal menyimpan
      </span>
    );
  }
  return null;
}
