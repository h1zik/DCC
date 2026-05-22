"use client";
import { actionErrorMessage } from "@/lib/action-error-message";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  RoomTimelineStatus,
  type Brand,
  type Project,
  type Room,
} from "@prisma/client";
import {
  ArrowUpDown,
  Filter,
  Milestone,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import {
  ProjectMilestoneSheet,
  type ProjectMilestoneDTO,
} from "@/components/projects/project-milestone-sheet";
import { computeMilestoneProgress } from "@/lib/project-milestones";
import { toast } from "sonner";
import {
  createProject,
  deleteProject,
  updateProjectMeta,
} from "@/actions/projects";
import { brandIdItems, idLabelItems, type SelectItemDef } from "@/lib/select-option-items";
import { cn } from "@/lib/utils";
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
  milestones: ProjectMilestoneDTO[];
};

type SortKey = "progress_desc" | "progress_asc" | "name";

function progressTone(pct: number): string {
  if (pct >= 100) return "text-emerald-600 dark:text-emerald-400";
  if (pct >= 50) return "text-primary";
  return "text-amber-600 dark:text-amber-400";
}

export function ProjectsPipeline({
  projects,
  brands,
  rooms,
  canManageProjects,
  canEditMilestones,
  isCeo,
}: {
  projects: ProjectRow[];
  brands: Brand[];
  rooms: RoomRow[];
  canManageProjects: boolean;
  canEditMilestones: boolean;
  isCeo: boolean;
}) {
  const router = useRouter();
  const [filterRoom, setFilterRoom] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("progress_desc");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [createRoomId, setCreateRoomId] = useState(rooms[0]?.id ?? "");
  const [brandId, setBrandId] = useState(brands[0]?.id ?? "");
  const [pending, setPending] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameId, setRenameId] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [renamePending, setRenamePending] = useState(false);
  const [milestoneProject, setMilestoneProject] = useState<ProjectRow | null>(
    null,
  );
  const [clientProjects, setClientProjects] = useState(projects);

  useEffect(() => {
    setClientProjects(projects);
    setMilestoneProject((prev) => {
      if (!prev) return prev;
      const fresh = projects.find((p) => p.id === prev.id);
      return fresh ?? prev;
    });
  }, [projects]);

  const patchProjectMilestones = useCallback(
    (projectId: string, milestones: ProjectMilestoneDTO[]) => {
      setClientProjects((rows) =>
        rows.map((p) => (p.id === projectId ? { ...p, milestones } : p)),
      );
      setMilestoneProject((prev) =>
        prev?.id === projectId ? { ...prev, milestones } : prev,
      );
    },
    [],
  );

  const enriched = useMemo(
    () =>
      clientProjects.map((p) => {
        const pct = computeMilestoneProgress(p.milestones);
        const done = p.milestones.filter(
          (m) => m.status === RoomTimelineStatus.DONE,
        ).length;
        const inProgress = p.milestones.filter(
          (m) => m.status === RoomTimelineStatus.IN_PROGRESS,
        ).length;
        const blocked = p.milestones.filter(
          (m) => m.status === RoomTimelineStatus.BLOCKED,
        ).length;
        return { ...p, pct, done, inProgress, blocked };
      }),
    [clientProjects],
  );

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = enriched;
    if (filterRoom !== "all") {
      list = list.filter((p) => p.roomId === filterRoom);
    }
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.brand?.name ?? "").toLowerCase().includes(q) ||
          p.room.name.toLowerCase().includes(q),
      );
    }
    const sorted = [...list];
    switch (sortKey) {
      case "progress_asc":
        sorted.sort((a, b) => a.pct - b.pct || a.name.localeCompare(b.name));
        break;
      case "name":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      default:
        sorted.sort((a, b) => b.pct - a.pct || a.name.localeCompare(b.name));
    }
    return sorted;
  }, [enriched, filterRoom, search, sortKey]);

  const stats = useMemo(() => {
    const list = filterRoom === "all" ? enriched : enriched.filter((p) => p.roomId === filterRoom);
    const total = list.length;
    if (total === 0) {
      return { total: 0, avg: 0, completed: 0, needsAttention: 0 };
    }
    const sum = list.reduce((acc, p) => acc + p.pct, 0);
    return {
      total,
      avg: Math.round(sum / total),
      completed: list.filter((p) => p.pct >= 100).length,
      needsAttention: list.filter((p) => p.pct < 50).length,
    };
  }, [enriched, filterRoom]);

  const filterRoomSelectItems = useMemo((): SelectItemDef[] => {
    return [{ value: "all", label: "Semua ruangan" }, ...idLabelItems(rooms)];
  }, [rooms]);

  const dialogRoomSelectItems = useMemo(() => idLabelItems(rooms), [rooms]);
  const dialogBrandSelectItems = useMemo(() => brandIdItems(brands), [brands]);

  async function onCreate() {
    if (!createRoomId || !brandId || !name.trim()) return;
    setPending(true);
    try {
      await createProject({
        roomId: createRoomId,
        brandId,
        name: name.trim(),
      });
      toast.success("Proyek dibuat dengan milestone default.");
      setOpen(false);
      setName("");
      router.refresh();
    } catch {
      toast.error("Gagal membuat proyek.");
    } finally {
      setPending(false);
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
    if (!confirm("Hapus proyek ini beserta milestone & tugasnya?")) return;
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
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/80 shadow-sm">
          <CardContent className="pt-5 pb-4">
            <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
              Proyek aktif
            </p>
            <p className="text-foreground mt-1 text-2xl font-bold tabular-nums">
              {stats.total}
            </p>
          </CardContent>
        </Card>
        <Card className="border-primary/20 bg-primary/5 shadow-sm">
          <CardContent className="pt-5 pb-4">
            <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
              Rata-rata milestone
            </p>
            <p
              className={cn(
                "mt-1 text-2xl font-bold tabular-nums",
                progressTone(stats.avg),
              )}
            >
              {stats.avg}%
            </p>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/25 bg-emerald-500/5 shadow-sm">
          <CardContent className="pt-5 pb-4">
            <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
              Selesai 100%
            </p>
            <p className="text-emerald-600 dark:text-emerald-400 mt-1 text-2xl font-bold tabular-nums">
              {stats.completed}
            </p>
          </CardContent>
        </Card>
        <Card className="border-amber-500/25 bg-amber-500/5 shadow-sm">
          <CardContent className="pt-5 pb-4">
            <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
              Perlu perhatian (&lt;50%)
            </p>
            <p className="text-amber-600 dark:text-amber-400 mt-1 text-2xl font-bold tabular-nums">
              {stats.needsAttention}
            </p>
          </CardContent>
        </Card>
      </div>

      {isCeo ? (
        <p className="text-muted-foreground border-border/80 bg-muted/30 rounded-lg border px-4 py-3 text-sm leading-relaxed">
          Mode pantau: klik kartu proyek untuk melihat detail milestone dan
          progress tim. Perubahan milestone dilakukan oleh studio / PM.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <div className="border-border focus-within:border-ring focus-within:ring-ring/40 flex min-w-[200px] flex-1 items-center gap-2 rounded-lg border px-2.5 transition-colors focus-within:ring-2">
          <Search className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari proyek, brand, ruangan…"
            className="placeholder:text-muted-foreground h-9 min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        {rooms.length > 0 ? (
          <Select
            value={filterRoom}
            items={filterRoomSelectItems}
            onValueChange={(v) => {
              if (v) setFilterRoom(v);
            }}
          >
            <SelectTrigger className="w-[200px]">
              <Filter className="text-muted-foreground mr-1 size-3.5" />
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
        ) : null}
        <Select
          value={sortKey}
          onValueChange={(v) => {
            if (v) setSortKey(v as SortKey);
          }}
        >
          <SelectTrigger className="w-[200px]">
            <ArrowUpDown className="text-muted-foreground mr-1 size-3.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="progress_desc">Progress tertinggi</SelectItem>
            <SelectItem value="progress_asc">Progress terendah</SelectItem>
            <SelectItem value="name">Nama A–Z</SelectItem>
          </SelectContent>
        </Select>
        {canManageProjects ? (
          <Button
            onClick={() => {
              const r = rooms[0];
              setCreateRoomId(r?.id ?? "");
              setBrandId(r?.brandId ?? brands[0]?.id ?? "");
              setOpen(true);
            }}
            disabled={rooms.length === 0 || brands.length === 0}
            className="shrink-0"
          >
            <Plus className="size-4" />
            Proyek baru
          </Button>
        ) : null}
      </div>

      {canManageProjects ? (
        <>
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
                  disabled={pending || !name.trim() || !brandId || !createRoomId}
                >
                  Simpan
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
        </>
      ) : null}

      {filteredProjects.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="text-muted-foreground flex flex-col items-center gap-2 py-16 text-center text-sm">
            <Milestone className="size-10 opacity-40" aria-hidden />
            <p>Tidak ada proyek yang cocok dengan filter.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredProjects.map((p) => (
            <Card
              key={p.id}
              className={cn(
                "hover:border-primary/35 overflow-hidden shadow-sm transition-colors",
                p.pct >= 100 && "border-emerald-500/30",
              )}
            >
              <button
                type="button"
                onClick={() => setMilestoneProject(p)}
                className="hover:bg-muted/20 w-full text-left transition-colors"
              >
                <CardHeader className="space-y-2 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base leading-snug">{p.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {p.room.name} · {p.brand?.name ?? "—"}
                      </CardDescription>
                    </div>
                    <div
                      className={cn(
                        "shrink-0 text-2xl font-bold tabular-nums",
                        progressTone(p.pct),
                      )}
                    >
                      {p.pct}%
                    </div>
                  </div>
                  <Progress value={p.pct} className="h-2.5" />
                  <div className="text-muted-foreground flex flex-wrap gap-2 text-[11px]">
                    <span className="tabular-nums">
                      {p.done}/{p.milestones.length} selesai
                    </span>
                    {p.inProgress > 0 ? (
                      <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                        {p.inProgress} berjalan
                      </Badge>
                    ) : null}
                    {p.blocked > 0 ? (
                      <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                        {p.blocked} terhambat
                      </Badge>
                    ) : null}
                  </div>
                </CardHeader>
              </button>
              <CardContent className="flex items-center justify-between gap-2 border-t border-border/60 pt-3 pb-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => setMilestoneProject(p)}
                >
                  <Milestone className="size-3.5" />
                  {canEditMilestones ? "Kelola milestone" : "Lihat milestone"}
                </Button>
                {canManageProjects ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className={cn(
                        buttonVariants({ variant: "ghost", size: "icon-sm" }),
                        "text-muted-foreground",
                      )}
                      aria-label="Menu proyek"
                    >
                      <MoreHorizontal className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setMilestoneProject(p)}>
                        <Milestone className="size-4" />
                        Milestone
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openRename(p)}>
                        <Pencil className="size-4" />
                        Ubah nama
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => void onDeleteProject(p.id)}
                      >
                        <Trash2 className="size-4" />
                        Hapus
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {milestoneProject ? (
        <ProjectMilestoneSheet
          open={Boolean(milestoneProject)}
          onOpenChange={(next) => {
            if (!next) setMilestoneProject(null);
          }}
          projectId={milestoneProject.id}
          projectName={milestoneProject.name}
          brandName={milestoneProject.brand?.name ?? null}
          brandColor={milestoneProject.brand?.colorCode ?? null}
          roomName={milestoneProject.room.name}
          milestones={milestoneProject.milestones}
          onMilestonesChange={(milestones) =>
            patchProjectMilestones(milestoneProject.id, milestones)
          }
          canEdit={canEditMilestones}
          readOnlyHint={
            !canEditMilestones
              ? isCeo
                ? "Anda memantau progress — perubahan milestone oleh tim studio / PM."
                : "Hanya lihat — milestone dikelola tim studio / PM."
              : undefined
          }
        />
      ) : null}
    </div>
  );
}
