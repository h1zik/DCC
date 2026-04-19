"use client";

import Image from "next/image";
import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ContentPlanJenis,
  ContentPlanStatusKerja,
  type User,
} from "@prisma/client";
import { toast } from "sonner";
import {
  clearContentPlanCopywritingFile,
  clearContentPlanDesignFiles,
  deleteRoomContentPlanItem,
  removeContentPlanDesignSlide,
  uploadContentPlanCopywritingFile,
  uploadContentPlanDesignFile,
  upsertRoomContentPlanItem,
} from "@/actions/room-content-planning";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { SelectItemDef } from "@/lib/select-option-items";
import {
  CalendarDays,
  FileText,
  Layers,
  LayoutList,
  MoreHorizontal,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  UserCircle,
} from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

const JENIS_LABEL: Record<ContentPlanJenis, string> = {
  [ContentPlanJenis.REELS]: "Reels",
  [ContentPlanJenis.CAROUSEL]: "Carousel",
  [ContentPlanJenis.SINGLE_FEED]: "Single Feed",
};

const STATUS_LABEL: Record<ContentPlanStatusKerja, string> = {
  [ContentPlanStatusKerja.BARU]: "Baru",
  [ContentPlanStatusKerja.DALAM_PROSES]: "Dalam Proses",
  [ContentPlanStatusKerja.DALAM_PENINJAUAN]: "Dalam Peninjauan",
  [ContentPlanStatusKerja.DIPUBLIKASIKAN]: "Dipublikasikan",
  [ContentPlanStatusKerja.DITANGGUHKAN]: "Ditangguhkan",
  [ContentPlanStatusKerja.DIJEDA]: "Dijeda",
};

export type ContentPlanTableRow = {
  id: string;
  konten: string;
  jenisKonten: ContentPlanJenis;
  detailKonten: string | null;
  copywritingFilePath: string | null;
  copywritingLink: string | null;
  designFilePaths: string[];
  designLink: string | null;
  picUserId: string | null;
  statusCopywriting: ContentPlanStatusKerja;
  statusDesign: ContentPlanStatusKerja;
  deadlineCopywriting: Date | string | null;
  deadlineDesign: Date | string | null;
  tanggalPosting: Date | string | null;
  catatan: string | null;
  pic: Pick<User, "id" | "name" | "email" | "image"> | null;
  createdBy: Pick<User, "id" | "name" | "email">;
};

type PicOption = Pick<User, "id" | "name" | "email">;

function toDateInput(v: Date | string | null | undefined): string {
  if (!v) return "";
  const d = typeof v === "string" ? new Date(v) : v;
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function formatDateShort(v: Date | string | null | undefined): string {
  if (!v) return "—";
  const d = typeof v === "string" ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function isImagePath(publicPath: string): boolean {
  const lower = publicPath.split("?")[0]?.toLowerCase() ?? "";
  return /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(lower);
}

function ExternalOrText({ value }: { value: string | null }) {
  if (!value?.trim()) return <span className="text-muted-foreground">—</span>;
  const t = value.trim();
  if (t.startsWith("http://") || t.startsWith("https://")) {
    return (
      <a
        href={t}
        target="_blank"
        rel="noopener noreferrer"
        className="text-accent-foreground max-w-[min(140px,22vw)] truncate text-xs underline-offset-2 hover:underline"
        title={t}
      >
        Link
      </a>
    );
  }
  return (
    <span
      className="text-muted-foreground block max-w-[min(140px,22vw)] truncate text-xs"
      title={t}
    >
      {t}
    </span>
  );
}

function FileLink({ path, short }: { path: string | null; short: string }) {
  if (!path) return <span className="text-muted-foreground">—</span>;
  return (
    <a
      href={path}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent-foreground text-xs underline-offset-2 hover:underline"
    >
      {short}
    </a>
  );
}

function StatusBadge({ status }: { status: ContentPlanStatusKerja }) {
  return (
    <Badge variant="outline" className="whitespace-nowrap text-[10px] font-normal">
      {STATUS_LABEL[status]}
    </Badge>
  );
}

function PicCell({ pic }: { pic: ContentPlanTableRow["pic"] }) {
  if (!pic) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  const label = pic.name?.trim() || pic.email;
  const initial = label.slice(0, 1).toUpperCase();
  return (
    <div className="flex max-w-[min(160px,24vw)] items-center gap-1.5">
      {pic.image ? (
        <Image
          src={pic.image}
          alt=""
          width={22}
          height={22}
          className="border-border size-[22px] shrink-0 rounded-full border object-cover"
          unoptimized
        />
      ) : (
        <div
          className="border-border bg-muted text-muted-foreground flex size-[22px] shrink-0 items-center justify-center rounded-full border text-[9px] font-semibold"
          aria-hidden
        >
          {initial}
        </div>
      )}
      <span className="truncate text-xs">{label}</span>
    </div>
  );
}

function DesignTableCell({ row }: { row: ContentPlanTableRow }) {
  const paths = row.designFilePaths ?? [];
  const isCarousel = row.jenisKonten === ContentPlanJenis.CAROUSEL;
  if (paths.length === 0) {
    return (
      <div className="flex max-w-[min(200px,28vw)] flex-col gap-1 text-xs">
        <span className="text-muted-foreground">—</span>
        <ExternalOrText value={row.designLink} />
      </div>
    );
  }
  if (isCarousel && paths.length > 1) {
    return (
      <div className="flex max-w-[min(220px,32vw)] flex-col gap-2">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {paths.map((p, i) => (
            <a
              key={p}
              href={p}
              target="_blank"
              rel="noopener noreferrer"
              title={`Slide ${i + 1}`}
              className="border-border bg-muted/40 shrink-0 overflow-hidden rounded-lg border shadow-sm"
            >
              {isImagePath(p) ? (
                <Image
                  src={p}
                  alt={`Slide ${i + 1}`}
                  width={44}
                  height={56}
                  className="size-11 object-cover sm:h-14 sm:w-11"
                  unoptimized
                />
              ) : (
                <div className="text-muted-foreground flex size-11 flex-col items-center justify-center gap-0.5 sm:h-14 sm:w-11">
                  <FileText className="size-4" />
                  <span className="text-[9px] font-medium">{i + 1}</span>
                </div>
              )}
            </a>
          ))}
        </div>
        <ExternalOrText value={row.designLink} />
      </div>
    );
  }
  return (
    <div className="flex max-w-[min(180px,26vw)] flex-col gap-1 text-xs">
      <FileLink path={paths[0] ?? null} short="Unduh file" />
      <ExternalOrText value={row.designLink} />
    </div>
  );
}

type CarouselRailProps = {
  paths: string[];
  roomId: string;
  itemId: string;
  onPathsChange: (next: string[]) => void;
};

function CarouselDesignRail({
  paths,
  roomId,
  itemId,
  onPathsChange,
}: CarouselRailProps) {
  const router = useRouter();
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">
          Urutan kiri → kanan = urutan slide carousel ({paths.length} file).
        </p>
        {paths.length > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="xs"
            className="text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={async () => {
              if (!confirm("Hapus semua file design untuk baris ini?")) return;
              try {
                await clearContentPlanDesignFiles(roomId, itemId);
                onPathsChange([]);
                toast.success("Semua slide dihapus.");
                router.refresh();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Gagal.");
              }
            }}
          >
            Hapus semua slide
          </Button>
        ) : null}
      </div>
      <div className="border-border bg-muted/20 flex gap-3 overflow-x-auto rounded-xl border p-3">
        {paths.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            Belum ada slide. Unggah gambar atau file di bawah — bisa pilih banyak
            sekaligus.
          </p>
        ) : (
          paths.map((p, i) => (
            <div
              key={p}
              className="border-border group relative shrink-0 overflow-hidden rounded-xl border bg-card shadow-sm"
              style={{ width: "5.75rem" }}
            >
              <div className="bg-accent text-accent-foreground absolute top-1.5 left-1.5 z-10 rounded-md px-1.5 py-0.5 text-[10px] font-semibold">
                {i + 1}
              </div>
              <button
                type="button"
                className="bg-destructive/90 text-destructive-foreground absolute top-1.5 right-1.5 z-10 flex size-6 items-center justify-center rounded-md opacity-0 transition-opacity group-hover:opacity-100"
                aria-label={`Hapus slide ${i + 1}`}
                onClick={async () => {
                  try {
                    await removeContentPlanDesignSlide(roomId, itemId, p);
                    onPathsChange(paths.filter((x) => x !== p));
                    toast.success("Slide dihapus.");
                    router.refresh();
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Gagal menghapus.");
                  }
                }}
              >
                <Trash2 className="size-3.5" />
              </button>
              <a
                href={p}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-muted/50 flex aspect-[4/5] w-full items-center justify-center"
              >
                {isImagePath(p) ? (
                  <Image
                    src={p}
                    alt=""
                    width={184}
                    height={230}
                    className="h-full w-full object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="text-muted-foreground flex flex-col items-center gap-1 p-2 text-center">
                    <FileText className="size-8 opacity-70" />
                    <span className="text-[10px] leading-tight">Buka file</span>
                  </div>
                )}
              </a>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function ContentPlanningClient({
  roomId,
  items,
  picUserOptions,
}: {
  roomId: string;
  items: ContentPlanTableRow[];
  picUserOptions: PicOption[];
}) {
  const router = useRouter();
  const copyFileRef = useRef<HTMLInputElement>(null);
  const designFileRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ContentPlanTableRow | null>(null);
  const [konten, setKonten] = useState("");
  const [jenisKonten, setJenisKonten] = useState<ContentPlanJenis>(
    ContentPlanJenis.REELS,
  );
  const [detailKonten, setDetailKonten] = useState("");
  const [copywritingLink, setCopywritingLink] = useState("");
  const [designLink, setDesignLink] = useState("");
  const [picUserId, setPicUserId] = useState<string>("");
  const [statusCopywriting, setStatusCopywriting] = useState<ContentPlanStatusKerja>(
    ContentPlanStatusKerja.BARU,
  );
  const [statusDesign, setStatusDesign] = useState<ContentPlanStatusKerja>(
    ContentPlanStatusKerja.BARU,
  );
  const [deadlineCopywriting, setDeadlineCopywriting] = useState("");
  const [deadlineDesign, setDeadlineDesign] = useState("");
  const [tanggalPosting, setTanggalPosting] = useState("");
  const [catatan, setCatatan] = useState("");
  const [pending, setPending] = useState(false);

  const isCarousel = jenisKonten === ContentPlanJenis.CAROUSEL;

  const jenisKontenSelectItems = useMemo((): SelectItemDef[] => {
    return (Object.values(ContentPlanJenis) as ContentPlanJenis[]).map((j) => ({
      value: j,
      label: JENIS_LABEL[j],
    }));
  }, []);

  const statusKerjaSelectItems = useMemo((): SelectItemDef[] => {
    return (
      Object.values(ContentPlanStatusKerja) as ContentPlanStatusKerja[]
    ).map((s) => ({ value: s, label: STATUS_LABEL[s] }));
  }, []);

  const picUserSelectItems = useMemo((): SelectItemDef[] => {
    return [
      { value: "__none__", label: "—" },
      ...picUserOptions.map((u) => ({
        value: u.id,
        label: u.name ?? u.email,
      })),
    ];
  }, [picUserOptions]);

  const reset = useCallback(() => {
    setEditing(null);
    setKonten("");
    setJenisKonten(ContentPlanJenis.REELS);
    setDetailKonten("");
    setCopywritingLink("");
    setDesignLink("");
    setPicUserId("");
    setStatusCopywriting(ContentPlanStatusKerja.BARU);
    setStatusDesign(ContentPlanStatusKerja.BARU);
    setDeadlineCopywriting("");
    setDeadlineDesign("");
    setTanggalPosting("");
    setCatatan("");
    if (copyFileRef.current) copyFileRef.current.value = "";
    if (designFileRef.current) designFileRef.current.value = "";
  }, []);

  const openCreate = useCallback(() => {
    reset();
    setOpen(true);
  }, [reset]);

  const openEdit = useCallback((row: ContentPlanTableRow) => {
    setEditing(row);
    setKonten(row.konten);
    setJenisKonten(row.jenisKonten);
    setDetailKonten(row.detailKonten ?? "");
    setCopywritingLink(row.copywritingLink ?? "");
    setDesignLink(row.designLink ?? "");
    setPicUserId(row.picUserId ?? "");
    setStatusCopywriting(row.statusCopywriting);
    setStatusDesign(row.statusDesign);
    setDeadlineCopywriting(toDateInput(row.deadlineCopywriting));
    setDeadlineDesign(toDateInput(row.deadlineDesign));
    setTanggalPosting(toDateInput(row.tanggalPosting));
    setCatatan(row.catatan ?? "");
    if (copyFileRef.current) copyFileRef.current.value = "";
    if (designFileRef.current) designFileRef.current.value = "";
    setOpen(true);
  }, []);

  const onDelete = useCallback(
    async (id: string) => {
      if (!confirm("Hapus baris ini?")) return;
      try {
        await deleteRoomContentPlanItem(roomId, id);
        toast.success("Baris dihapus.");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Gagal menghapus.");
      }
    },
    [roomId, router],
  );

  async function onSave() {
    if (!konten.trim()) return;
    setPending(true);
    try {
      const dc = deadlineCopywriting.trim()
        ? new Date(deadlineCopywriting)
        : null;
      const dd = deadlineDesign.trim() ? new Date(deadlineDesign) : null;
      const tp = tanggalPosting.trim() ? new Date(tanggalPosting) : null;

      const { id } = await upsertRoomContentPlanItem({
        id: editing?.id,
        roomId,
        konten: konten.trim(),
        jenisKonten,
        detailKonten: detailKonten.trim() || null,
        copywritingLink: copywritingLink.trim() || null,
        designLink: designLink.trim() || null,
        picUserId: picUserId || null,
        statusCopywriting,
        statusDesign,
        deadlineCopywriting: dc,
        deadlineDesign: dd,
        tanggalPosting: tp,
        catatan: catatan.trim() || null,
      });

      const copyInput = copyFileRef.current;
      const cf = copyInput?.files?.[0];
      if (cf && copyInput) {
        const fd = new FormData();
        fd.append("file", cf);
        await uploadContentPlanCopywritingFile(roomId, id, fd);
        copyInput.value = "";
      }

      const designInput = designFileRef.current;
      const files = designInput?.files;
      if (files && files.length > 0) {
        const list = isCarousel ? Array.from(files) : [files[0]!];
        for (const file of list) {
          const fd = new FormData();
          fd.append("file", file);
          fd.append("replaceSingle", isCarousel ? "0" : "1");
          await uploadContentPlanDesignFile(roomId, id, fd);
        }
        designInput.value = "";
      }

      toast.success(editing ? "Baris diperbarui." : "Baris ditambahkan.");
      setOpen(false);
      reset();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setPending(false);
    }
  }

  const columns = useMemo<ColumnDef<ContentPlanTableRow>[]>(
    () => [
      {
        accessorKey: "konten",
        header: "Konten",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.konten}</span>
        ),
      },
      {
        id: "jenis",
        header: "Jenis konten",
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs whitespace-nowrap">
            {JENIS_LABEL[row.original.jenisKonten]}
          </span>
        ),
      },
      {
        id: "detail",
        header: "Detail konten",
        cell: ({ row }) => {
          const t = row.original.detailKonten;
          if (!t?.trim()) return <span className="text-muted-foreground">—</span>;
          return (
            <span
              className="text-muted-foreground line-clamp-2 max-w-[min(200px,28vw)] text-xs"
              title={t}
            >
              {t}
            </span>
          );
        },
      },
      {
        id: "cw",
        header: "File copywriting",
        cell: ({ row }) => (
          <div className="flex max-w-[min(180px,26vw)] flex-col gap-1 text-xs">
            <FileLink path={row.original.copywritingFilePath} short="Unduh file" />
            <ExternalOrText value={row.original.copywritingLink} />
          </div>
        ),
      },
      {
        id: "design",
        header: "Link file design",
        cell: ({ row }) => <DesignTableCell row={row.original} />,
      },
      {
        id: "pic",
        header: "PIC",
        cell: ({ row }) => <PicCell pic={row.original.pic} />,
      },
      {
        id: "stCw",
        header: "Status copywriting",
        cell: ({ row }) => <StatusBadge status={row.original.statusCopywriting} />,
      },
      {
        id: "stDes",
        header: "Status design",
        cell: ({ row }) => <StatusBadge status={row.original.statusDesign} />,
      },
      {
        id: "dlCw",
        header: "Deadline copywriting",
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs whitespace-nowrap">
            {formatDateShort(row.original.deadlineCopywriting)}
          </span>
        ),
      },
      {
        id: "dlDes",
        header: "Deadline design",
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs whitespace-nowrap">
            {formatDateShort(row.original.deadlineDesign)}
          </span>
        ),
      },
      {
        id: "post",
        header: "Tanggal postingan",
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs whitespace-nowrap">
            {formatDateShort(row.original.tanggalPosting)}
          </span>
        ),
      },
      {
        id: "catatan",
        header: "Catatan",
        cell: ({ row }) => {
          const t = row.original.catatan;
          if (!t?.trim()) return <span className="text-muted-foreground">—</span>;
          return (
            <span
              className="text-muted-foreground line-clamp-2 max-w-[min(160px,22vw)] text-xs"
              title={t}
            >
              {t}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  buttonVariants({ variant: "ghost", size: "icon-sm" }),
                  "size-8",
                )}
              >
                <MoreHorizontal className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openEdit(row.original)}>
                  <Pencil className="size-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => onDelete(row.original.id)}
                >
                  <Trash2 className="size-4" />
                  Hapus
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [onDelete, openEdit],
  );

  const editingPaths = editing?.designFilePaths ?? [];
  const editingId = editing?.id;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" onClick={openCreate}>
          <Plus className="size-4" />
          Baris baru
        </Button>
        <Sheet
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) reset();
          }}
        >
          <SheetContent
            side="right"
            showCloseButton
            className="data-[side=right]:sm:max-w-2xl flex w-full max-w-full flex-col gap-0 border-l p-0 lg:max-w-[min(42rem,100vw-2rem)]"
          >
            <SheetHeader className="border-border shrink-0 space-y-1 border-b px-6 py-5 text-left">
              <SheetTitle className="text-lg">
                {editing ? "Edit baris content planning" : "Baris content planning baru"}
              </SheetTitle>
              <SheetDescription>
                Isi per blok. Tombol Simpan juga mengunggah file copywriting dan design
                yang dipilih pada langkah yang sama.
              </SheetDescription>
            </SheetHeader>

            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
              <Card size="sm" className="shadow-none ring-border/60">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <LayoutList className="text-accent-foreground size-4" />
                    <CardTitle className="text-sm">Ringkasan konten</CardTitle>
                  </div>
                  <CardDescription>Nama, format, dan PIC.</CardDescription>
                </CardHeader>
                <div className="grid gap-4 px-4 pb-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="cp-konten">Konten (nama)</Label>
                    <Input
                      id="cp-konten"
                      value={konten}
                      onChange={(e) => setKonten(e.target.value)}
                      placeholder="Judul atau nama konten"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Jenis konten</Label>
                    <Select
                      value={jenisKonten}
                      items={jenisKontenSelectItems}
                      onValueChange={(v) => {
                        if (v) setJenisKonten(v as ContentPlanJenis);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.values(ContentPlanJenis) as ContentPlanJenis[]).map(
                          (j) => (
                            <SelectItem key={j} value={j}>
                              {JENIS_LABEL[j]}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="inline-flex items-center gap-1.5">
                      <UserCircle className="size-3.5 opacity-70" />
                      PIC
                    </Label>
                    <Select
                      value={picUserId || "__none__"}
                      items={picUserSelectItems}
                      onValueChange={(v) => {
                        if (!v || v === "__none__") setPicUserId("");
                        else setPicUserId(v);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">—</SelectItem>
                        {picUserOptions.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name ?? u.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="cp-detail">Detail konten</Label>
                    <Textarea
                      id="cp-detail"
                      rows={4}
                      value={detailKonten}
                      onChange={(e) => setDetailKonten(e.target.value)}
                      placeholder="Brief, angle, CTA, referensi…"
                    />
                  </div>
                </div>
              </Card>

              <Card size="sm" className="shadow-none ring-border/60">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="text-accent-foreground size-4" />
                    <CardTitle className="text-sm">Copywriting</CardTitle>
                  </div>
                  <CardDescription>Link eksternal atau unggah satu file pendukung.</CardDescription>
                </CardHeader>
                <div className="grid gap-4 px-4 pb-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="cp-cw-link">Link / teks (opsional)</Label>
                    <Input
                      id="cp-cw-link"
                      value={copywritingLink}
                      onChange={(e) => setCopywritingLink(e.target.value)}
                      placeholder="https://…"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Unggah file</Label>
                    <div className="border-border bg-muted/30 flex flex-col gap-2 rounded-lg border border-dashed p-3">
                      <Input
                        ref={copyFileRef}
                        type="file"
                        className="text-muted-foreground cursor-pointer text-xs file:mr-3 file:rounded-md file:border-0 file:bg-accent/30 file:px-2 file:py-1 file:text-xs file:font-medium"
                      />
                      <p className="text-muted-foreground text-[11px]">
                        Maks. 15 MB — dokumen, PDF, gambar, zip.
                      </p>
                    </div>
                    {editing?.copywritingFilePath ? (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <a
                          href={editing.copywritingFilePath}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent-foreground text-xs font-medium underline-offset-2 hover:underline"
                        >
                          File terunggah
                        </a>
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          className="text-destructive h-7"
                          onClick={async () => {
                            try {
                              await clearContentPlanCopywritingFile(roomId, editing.id);
                              toast.success("File copywriting dihapus.");
                              setEditing((prev) =>
                                prev ? { ...prev, copywritingFilePath: null } : prev,
                              );
                              router.refresh();
                            } catch (e) {
                              toast.error(
                                e instanceof Error ? e.message : "Gagal menghapus file.",
                              );
                            }
                          }}
                        >
                          Hapus file
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </Card>

              <Card size="sm" className="shadow-none ring-border/60">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Layers className="text-accent-foreground size-4" />
                    <CardTitle className="text-sm">Design</CardTitle>
                  </div>
                  <CardDescription>
                    {isCarousel
                      ? "Carousel: tampilan slide rapi di bawah. Unggah beberapa gambar sekaligus (multi-select)."
                      : "Reels / Single feed: satu file design utama."}
                  </CardDescription>
                </CardHeader>
                <div className="space-y-4 px-4 pb-4">
                  <div className="space-y-2">
                    <Label htmlFor="cp-des-link">Link design (opsional)</Label>
                    <Input
                      id="cp-des-link"
                      value={designLink}
                      onChange={(e) => setDesignLink(e.target.value)}
                      placeholder="https://… Figma, Drive, dll."
                    />
                  </div>

                  {editingId && isCarousel ? (
                    <CarouselDesignRail
                      paths={editingPaths}
                      roomId={roomId}
                      itemId={editingId}
                      onPathsChange={(next) =>
                        setEditing((prev) =>
                          prev ? { ...prev, designFilePaths: next } : prev,
                        )
                      }
                    />
                  ) : editingId && !isCarousel && editingPaths[0] ? (
                    <div className="border-border bg-muted/20 flex max-w-xs items-center gap-3 rounded-xl border p-3">
                      {isImagePath(editingPaths[0]) ? (
                        <Image
                          src={editingPaths[0]}
                          alt=""
                          width={72}
                          height={72}
                          className="border-border size-[72px] rounded-lg border object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="border-border bg-background flex size-[72px] items-center justify-center rounded-lg border">
                          <FileText className="text-muted-foreground size-8" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1 space-y-1">
                        <a
                          href={editingPaths[0]}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent-foreground text-sm font-medium underline-offset-2 hover:underline"
                        >
                          Buka file design
                        </a>
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          className="text-destructive mt-1"
                          onClick={async () => {
                            try {
                              await clearContentPlanDesignFiles(roomId, editingId);
                              setEditing((prev) =>
                                prev ? { ...prev, designFilePaths: [] } : prev,
                              );
                              toast.success("File design dihapus.");
                              router.refresh();
                            } catch (e) {
                              toast.error(
                                e instanceof Error ? e.message : "Gagal menghapus.",
                              );
                            }
                          }}
                        >
                          Ganti file
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <Label>
                      {isCarousel ? "Tambah slide (boleh banyak file)" : "Unggah / ganti file design"}
                    </Label>
                    <div className="border-border bg-muted/30 flex flex-col gap-2 rounded-lg border border-dashed p-3">
                      <Input
                        ref={designFileRef}
                        type="file"
                        multiple={isCarousel}
                        accept="image/*,.pdf,.doc,.docx,application/pdf"
                        className="text-muted-foreground cursor-pointer text-xs file:mr-3 file:rounded-md file:border-0 file:bg-accent/30 file:px-2 file:py-1 file:text-xs file:font-medium"
                      />
                      <p className="text-muted-foreground text-[11px]">
                        {isCarousel
                          ? "Pilih beberapa gambar sekaligus untuk urutan slide. Simpan form dulu jika ini baris baru, lalu unggah lagi bila perlu."
                          : "Satu file menggantikan file sebelumnya. Simpan form setelah memilih file."}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>

              <Card size="sm" className="shadow-none ring-border/60">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="text-accent-foreground size-4" />
                    <CardTitle className="text-sm">Status & jadwal</CardTitle>
                  </div>
                  <CardDescription>Alur kerja dan deadline.</CardDescription>
                </CardHeader>
                <div className="grid gap-4 px-4 pb-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Status copywriting</Label>
                    <Select
                      value={statusCopywriting}
                      items={statusKerjaSelectItems}
                      onValueChange={(v) => {
                        if (v) setStatusCopywriting(v as ContentPlanStatusKerja);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(
                          Object.values(ContentPlanStatusKerja) as ContentPlanStatusKerja[]
                        ).map((s) => (
                          <SelectItem key={s} value={s}>
                            {STATUS_LABEL[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status design</Label>
                    <Select
                      value={statusDesign}
                      items={statusKerjaSelectItems}
                      onValueChange={(v) => {
                        if (v) setStatusDesign(v as ContentPlanStatusKerja);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(
                          Object.values(ContentPlanStatusKerja) as ContentPlanStatusKerja[]
                        ).map((s) => (
                          <SelectItem key={s} value={s}>
                            {STATUS_LABEL[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cp-dl-cw">Deadline copywriting</Label>
                    <Input
                      id="cp-dl-cw"
                      type="date"
                      value={deadlineCopywriting}
                      onChange={(e) => setDeadlineCopywriting(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cp-dl-des">Deadline design</Label>
                    <Input
                      id="cp-dl-des"
                      type="date"
                      value={deadlineDesign}
                      onChange={(e) => setDeadlineDesign(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="cp-post">Tanggal postingan</Label>
                    <Input
                      id="cp-post"
                      type="date"
                      value={tanggalPosting}
                      onChange={(e) => setTanggalPosting(e.target.value)}
                    />
                  </div>
                </div>
              </Card>

              <div className="space-y-2">
                <Label htmlFor="cp-cat" className="text-sm font-medium">
                  Catatan
                </Label>
                <Textarea
                  id="cp-cat"
                  rows={3}
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  placeholder="Catatan internal untuk tim…"
                  className="resize-none"
                />
              </div>
            </div>

            <Separator />

            <SheetFooter className="bg-background/95 supports-backdrop-filter:backdrop-blur-sm shrink-0 flex-row flex-wrap justify-end gap-2 border-t px-6 py-4">
              <Button variant="outline" type="button" onClick={() => setOpen(false)}>
                Batal
              </Button>
              <Button type="button" onClick={onSave} disabled={pending || !konten.trim()}>
                {pending ? "Menyimpan…" : "Simpan"}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      <div className="w-full max-w-full overflow-x-auto">
        <DataTable
          columns={columns}
          data={items}
          empty="Belum ada baris. Tambahkan konten lewat tombol Baris baru."
          onRowClick={(row) => openEdit(row)}
        />
      </div>
    </div>
  );
}
