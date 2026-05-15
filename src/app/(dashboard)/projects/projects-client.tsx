"use client";
import { actionErrorMessage } from "@/lib/action-error-message";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { differenceInCalendarDays } from "date-fns";
import {
  PipelineStage,
  type Brand,
  type Project,
  type Room,
  type Task,
} from "@prisma/client";
import { AlertTriangle, Filter, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  cancelProjectPipelineRequest,
  createProject,
  deleteProject,
  requestProjectPipelineStage,
  updateProjectMeta,
} from "@/actions/projects";
import { PIPELINE_LABELS, PIPELINE_ORDER } from "@/lib/pipeline";
import { brandIdItems, idLabelItems, type SelectItemDef } from "@/lib/select-option-items";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type RoomRow = Room & { brand: Brand | null };

type ProjectRow = Project & {
  brand: Brand | null;
  room: RoomRow;
  tasks: Pick<Task, "id" | "status">[];
  pendingPipelineStage?: PipelineStage | null;
  pipelineStageRequestedAt?: Date | null;
};

export function ProjectsPipeline({
  projects,
  brands,
  rooms,
  canEdit,
  isCeo,
}: {
  projects: ProjectRow[];
  brands: Brand[];
  rooms: RoomRow[];
  canEdit: boolean;
  isCeo: boolean;
}) {
  const router = useRouter();
  const [filterRoom, setFilterRoom] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [createRoomId, setCreateRoomId] = useState(rooms[0]?.id ?? "");
  const [brandId, setBrandId] = useState(brands[0]?.id ?? "");
  const [pending, setPending] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameId, setRenameId] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [renamePending, setRenamePending] = useState(false);

  const filteredProjects = useMemo(() => {
    if (filterRoom === "all") return projects;
    return projects.filter((p) => p.roomId === filterRoom);
  }, [projects, filterRoom]);

  const filterRoomSelectItems = useMemo((): SelectItemDef[] => {
    return [
      { value: "all", label: "Semua ruangan" },
      ...idLabelItems(rooms),
    ];
  }, [rooms]);

  const dialogRoomSelectItems = useMemo(() => idLabelItems(rooms), [rooms]);
  const dialogBrandSelectItems = useMemo(() => brandIdItems(brands), [brands]);
  const pipelineStageSelectItems = useMemo(
    () =>
      PIPELINE_ORDER.map((s) => ({
        value: s,
        label: PIPELINE_LABELS[s],
      })),
    [],
  );

  async function onCreate() {
    if (!createRoomId || !brandId || !name.trim()) return;
    setPending(true);
    try {
      await createProject({
        roomId: createRoomId,
        brandId,
        name: name.trim(),
      });
      toast.success("Proyek dibuat.");
      setOpen(false);
      setName("");
      router.refresh();
    } catch {
      toast.error("Gagal membuat proyek.");
    } finally {
      setPending(false);
    }
  }

  async function onStageChange(projectId: string, stage: PipelineStage) {
    try {
      await requestProjectPipelineStage({ projectId, stage });
      toast.success(
        isCeo
          ? "Tahap proyek diperbarui."
          : "Pengajuan dikirim ke CEO. Tahap resmi berubah setelah disetujui.",
      );
      router.refresh();
    } catch (e) {
      const msg = actionErrorMessage(e, "Gagal mengubah tahap.");
      toast.error(msg);
    }
  }

  async function onCancelPipelineRequest(projectId: string) {
    try {
      await cancelProjectPipelineRequest(projectId);
      toast.success("Pengajuan pindah tahap dibatalkan.");
      router.refresh();
    } catch (e) {
      toast.error(actionErrorMessage(e, "Gagal membatalkan."));
    }
  }

  function openRename(p: ProjectRow) {
    setRenameId(p.id);
    setRenameValue(p.name);
    setRenameOpen(true);
  }

  async function onRenameSave() {
    const n = renameValue.trim();
    if (!renameId || !n) return;
    setRenamePending(true);
    try {
      await updateProjectMeta({ projectId: renameId, name: n });
      toast.success("Nama proyek diperbarui.");
      setRenameOpen(false);
      router.refresh();
    } catch {
      toast.error("Gagal menyimpan nama.");
    } finally {
      setRenamePending(false);
    }
  }

  async function onDeleteProject(projectId: string) {
    if (!confirm("Hapus proyek ini beserta semua tugasnya? Tindakan tidak dapat dibatalkan.")) {
      return;
    }
    try {
      await deleteProject(projectId);
      toast.success("Proyek dihapus.");
      router.refresh();
    } catch {
      toast.error("Gagal menghapus proyek.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {rooms.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Filter className="size-4" />
            <span>Filter ruangan</span>
          </div>
          <Select
            value={filterRoom}
            items={filterRoomSelectItems}
            onValueChange={(v) => {
              if (v) setFilterRoom(v);
            }}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua ruangan</SelectItem>
              {rooms.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {canEdit ? (
        <div className="flex flex-wrap justify-end gap-2">
          {isCeo ? (
            <>
              <Button
                onClick={() => {
                  const r = rooms[0];
                  setCreateRoomId(r?.id ?? "");
                  setBrandId(r?.brandId ?? brands[0]?.id ?? "");
                  setOpen(true);
                }}
                disabled={rooms.length === 0 || brands.length === 0}
              >
                <Plus className="size-4" />
                Proyek baru
              </Button>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Proyek pengembangan produk</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-3 py-2">
                    <div className="space-y-2">
                      <Label>Ruangan kerja</Label>
                      <Select
                        value={createRoomId}
                        items={dialogRoomSelectItems}
                        onValueChange={(v) => {
                          if (!v) return;
                          setCreateRoomId(v);
                          const room = rooms.find((x) => x.id === v);
                          if (room?.brandId) setBrandId(room.brandId);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih room" />
                        </SelectTrigger>
                        <SelectContent>
                          {rooms.map((r) => (
                            <SelectItem key={r.id} value={r.id}>
                              {r.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Brand proyek</Label>
                      <Select
                        value={brandId}
                        items={dialogBrandSelectItems}
                        onValueChange={(v) => {
                          if (v) setBrandId(v);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Brand" />
                        </SelectTrigger>
                        <SelectContent>
                          {brands.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pname">Nama proyek</Label>
                      <Input
                        id="pname"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Contoh: Peluncuran serum baru Q3"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                      Batal
                    </Button>
                    <Button
                      onClick={onCreate}
                      disabled={
                        pending || !name.trim() || !brandId || !createRoomId
                      }
                    >
                      Simpan
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          ) : null}
          <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Ubah nama proyek</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3 py-2">
                <div className="space-y-2">
                  <Label htmlFor="rename-p">Nama</Label>
                  <Input
                    id="rename-p"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRenameOpen(false)}>
                  Batal
                </Button>
                <Button
                  onClick={() => void onRenameSave()}
                  disabled={renamePending || !renameValue.trim()}
                >
                  Simpan
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3 2xl:grid-cols-6">
        {PIPELINE_ORDER.map((stage) => {
          const inStage = filteredProjects.filter(
            (p) => p.currentStage === stage,
          );
          return (
            <div key={stage} className="flex min-h-[320px] flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold tracking-tight">
                  {PIPELINE_LABELS[stage]}
                </h2>
                <Badge variant="secondary" className="tabular-nums">
                  {inStage.length}
                </Badge>
              </div>
              <div className="bg-muted/30 flex flex-1 flex-col gap-2 rounded-xl border border-border p-2">
                {inStage.map((p) => {
                  const stuck = differenceInCalendarDays(
                    new Date(),
                    new Date(p.stageEnteredAt),
                  );
                  const bottleneck = stuck >= 5;
                  return (
                    <Card key={p.id} className="shadow-sm">
                      <CardHeader className="space-y-1 pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="min-w-0 flex-1 text-sm leading-snug">
                            {p.name}
                          </CardTitle>
                          <div className="flex shrink-0 items-center gap-1">
                            {p.brand?.colorCode ? (
                              <span
                                className="mt-0.5 size-2.5 rounded-full border border-border"
                                style={{ backgroundColor: p.brand!.colorCode }}
                              />
                            ) : null}
                            {canEdit ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger
                                  className={cn(
                                    buttonVariants({
                                      variant: "ghost",
                                      size: "icon-sm",
                                    }),
                                    "text-muted-foreground size-8",
                                  )}
                                  aria-label="Menu proyek"
                                >
                                  <MoreHorizontal className="size-4" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => openRename(p)}>
                                    <Pencil className="size-4" />
                                    Ubah nama
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onClick={() => void onDeleteProject(p.id)}
                                  >
                                    <Trash2 className="size-4" />
                                    Hapus proyek
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : null}
                          </div>
                        </div>
                        <CardDescription>
                          {p.room.name} · {p.brand?.name ?? "—"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-3 pt-0">
                        <div className="space-y-1">
                          <div className="text-muted-foreground flex justify-between text-xs">
                            <span>Progress tugas</span>
                            <span className="tabular-nums">{p.totalProgress}%</span>
                          </div>
                          <Progress value={p.totalProgress} className="h-2" />
                        </div>
                        {bottleneck ? (
                          <Alert variant="destructive" className="py-2">
                            <AlertTriangle className="size-4" />
                            <AlertTitle className="text-xs">Tertahan</AlertTitle>
                            <AlertDescription className="text-xs">
                              Di tahap ini sudah {stuck} hari — periksa hambatan
                              (mis. approval packaging).
                            </AlertDescription>
                          </Alert>
                        ) : null}
                        {p.pendingPipelineStage ? (
                          <Alert className="border-amber-500/40 bg-amber-500/10 py-2">
                            <AlertTitle className="text-xs text-amber-950 dark:text-amber-50">
                              Menunggu persetujuan CEO
                            </AlertTitle>
                            <AlertDescription className="text-xs text-pretty">
                              Diajukan pindah ke{" "}
                              <span className="font-medium">
                                {PIPELINE_LABELS[p.pendingPipelineStage]}
                              </span>
                              . Tahap resmi masih{" "}
                              <span className="font-medium">
                                {PIPELINE_LABELS[p.currentStage]}
                              </span>
                              .
                              {!isCeo ? (
                                <>
                                  {" "}
                                  <button
                                    type="button"
                                    className="text-accent-foreground font-medium underline-offset-2 hover:underline"
                                    onClick={() =>
                                      void onCancelPipelineRequest(p.id)
                                    }
                                  >
                                    Batalkan pengajuan
                                  </button>
                                </>
                              ) : null}
                            </AlertDescription>
                          </Alert>
                        ) : null}
                        {canEdit ? (
                          <div className="space-y-1">
                            <Label className="text-xs">
                              {isCeo
                                ? "Pindah tahap (langsung)"
                                : "Ajukan pindah tahap"}
                            </Label>
                            <Select
                              value={
                                (p.pendingPipelineStage ??
                                  p.currentStage) as PipelineStage
                              }
                              items={pipelineStageSelectItems}
                              onValueChange={(v) => {
                                if (v) void onStageChange(p.id, v as PipelineStage);
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {PIPELINE_ORDER.map((s) => (
                                  <SelectItem key={s} value={s}>
                                    {PIPELINE_LABELS[s]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {!isCeo ? (
                              <p className="text-muted-foreground text-[11px] leading-snug">
                                Pilih tahap tujuan lalu kirim — pilih kembali
                                tahap resmi saat ini untuk membatalkan pengajuan.
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
