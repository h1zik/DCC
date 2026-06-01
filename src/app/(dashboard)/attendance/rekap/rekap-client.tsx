"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import {
  format,
  subDays,
  subMonths,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { toast } from "sonner";
import { UserRole } from "@prisma/client";
import {
  ClipboardList,
  LayoutDashboard,
  ScanFace,
  Download,
  Trash2,
  Calendar,
  TriangleAlert,
  UserCheck,
  LogIn,
  LogOut,
  Thermometer,
  FileText,
  Users,
  Loader2,
} from "lucide-react";
import { PageHero } from "@/components/page-hero";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { effectiveRoleLabel } from "@/lib/role-labels";
import { ATTENDANCE_TYPE_LABELS } from "@/lib/attendance-constants";
import type { DashboardData, EmployeeStatus, RegistrationRow } from "./data";

const WeeklyChart = dynamic(() => import("./attendance-weekly-chart"), {
  ssr: false,
  loading: () => (
    <div className="bg-muted/40 flex h-64 items-center justify-center rounded-lg">
      <Loader2 className="text-muted-foreground size-6 animate-spin" />
    </div>
  ),
});

/* -------------------------------------------------------------------------- */

interface ApiRecord {
  id: string;
  type: "CHECK_IN" | "CHECK_OUT" | "SICK" | "PERMISSION";
  timestamp: string;
  date: string;
  confidence: number;
  reason: string | null;
  todoList: string | null;
  completedTasks: string | null;
  user: {
    id: string;
    name: string | null;
    email: string;
    role: UserRole;
    customRole: { name: string } | null;
  };
}

const TYPE_BADGE: Record<string, "default" | "secondary" | "outline"> = {
  CHECK_IN: "default",
  CHECK_OUT: "secondary",
  SICK: "outline",
  PERMISSION: "outline",
};

const STATUS_META: Record<EmployeeStatus, { label: string; class: string }> = {
  PRESENT: {
    label: "Hadir",
    class: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  },
  DONE: {
    label: "Selesai",
    class: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  },
  SICK: {
    label: "Sakit",
    class: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  PERMISSION: {
    label: "Izin",
    class: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  },
  ABSENT: { label: "Belum hadir", class: "bg-muted text-muted-foreground" },
};

export function RekapClient({
  dashboard,
  registrations,
}: {
  dashboard: DashboardData;
  registrations: RegistrationRow[];
}) {
  return (
    <>
      <PageHero
        icon={ClipboardList}
        title="Rekap Absensi"
        subtitle="Pantau kehadiran tim, tinjau rekap data, dan kelola registrasi wajah."
      />

      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard">
            <LayoutDashboard className="size-3.5" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="rekap">
            <ClipboardList className="size-3.5" />
            Rekap Data
          </TabsTrigger>
          <TabsTrigger value="registrasi">
            <ScanFace className="size-3.5" />
            Registrasi Wajah
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="pt-4">
          <DashboardTab data={dashboard} />
        </TabsContent>
        <TabsContent value="rekap" className="pt-4">
          <RekapTab />
        </TabsContent>
        <TabsContent value="registrasi" className="pt-4">
          <RegistrasiTab rows={registrations} />
        </TabsContent>
      </Tabs>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*                                Dashboard tab                              */
/* -------------------------------------------------------------------------- */

function DashboardTab({ data }: { data: DashboardData }) {
  const { todayStats, weekly, byRole, statuses, recent } = data;
  const rate =
    todayStats.totalUsers > 0
      ? Math.round((todayStats.present / todayStats.totalUsers) * 100)
      : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard icon={UserCheck} label="Hadir" value={todayStats.present} sub={`${rate}%`} />
        <StatCard icon={LogIn} label="Check In" value={todayStats.checkIn} />
        <StatCard icon={LogOut} label="Check Out" value={todayStats.checkOut} />
        <StatCard icon={Thermometer} label="Sakit" value={todayStats.sick} />
        <StatCard icon={FileText} label="Izin" value={todayStats.permission} />
        <StatCard
          icon={ScanFace}
          label="Wajah terdaftar"
          value={todayStats.registered}
          sub={`/ ${todayStats.totalUsers}`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Kehadiran 7 Hari Terakhir</CardTitle>
          </CardHeader>
          <CardContent>
            <WeeklyChart data={weekly} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Kehadiran per Peran</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {byRole.length === 0 ? (
              <p className="text-muted-foreground text-sm">Belum ada data.</p>
            ) : (
              byRole.map((r) => {
                const pct =
                  r.total > 0 ? Math.round((r.hadir / r.total) * 100) : 0;
                return (
                  <div key={r.role} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{r.role}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {r.hadir}/{r.total}
                      </span>
                    </div>
                    <div className="bg-muted h-2 overflow-hidden rounded-full">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Status Karyawan Hari Ini</CardTitle>
          </CardHeader>
          <CardContent>
            {statuses.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                Belum ada karyawan.
              </p>
            ) : (
              <div className="flex flex-col">
                {statuses.map((s) => {
                  const meta = STATUS_META[s.status];
                  return (
                    <div
                      key={s.name}
                      className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-0"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-medium",
                            meta.class,
                          )}
                        >
                          {meta.label}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {s.name}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {s.role}
                          </p>
                        </div>
                      </div>
                      <span className="text-muted-foreground shrink-0 font-mono text-xs">
                        {s.checkIn ?? "—"}
                        {s.checkOut ? ` → ${s.checkOut}` : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Aktivitas Terkini</CardTitle>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                Belum ada aktivitas hari ini.
              </p>
            ) : (
              <div className="flex flex-col">
                {recent.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-0"
                  >
                    <div className="flex items-center gap-2.5">
                      <Badge variant={TYPE_BADGE[a.type] ?? "outline"}>
                        {ATTENDANCE_TYPE_LABELS[
                          a.type as keyof typeof ATTENDANCE_TYPE_LABELS
                        ] ?? a.type}
                      </Badge>
                      <div>
                        <p className="text-sm font-medium">{a.name}</p>
                        <p className="text-muted-foreground text-xs">
                          {a.role}
                        </p>
                      </div>
                    </div>
                    <span className="text-muted-foreground font-mono text-xs">
                      {a.time}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof UserCheck;
  label: string;
  value: number;
  sub?: string;
}) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-1">
        <div className="text-muted-foreground flex items-center gap-1.5">
          <Icon className="size-3.5" />
          <span className="text-xs font-medium">{label}</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-semibold tabular-nums">{value}</span>
          {sub ? (
            <span className="text-muted-foreground text-sm">{sub}</span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  Rekap tab                                */
/* -------------------------------------------------------------------------- */

type RangePreset =
  | "today"
  | "7days"
  | "30days"
  | "this_month"
  | "last_month"
  | "custom";

const RANGE_PRESETS: { key: RangePreset; label: string }[] = [
  { key: "today", label: "Hari Ini" },
  { key: "7days", label: "7 Hari" },
  { key: "30days", label: "30 Hari" },
  { key: "this_month", label: "Bulan Ini" },
  { key: "last_month", label: "Bulan Lalu" },
  { key: "custom", label: "Kustom" },
];

function presetRange(preset: RangePreset): { start: string; end: string } {
  const today = new Date();
  const f = (d: Date) => format(d, "yyyy-MM-dd");
  switch (preset) {
    case "7days":
      return { start: f(subDays(today, 6)), end: f(today) };
    case "30days":
      return { start: f(subDays(today, 29)), end: f(today) };
    case "this_month":
      return { start: f(startOfMonth(today)), end: f(today) };
    case "last_month": {
      const last = subMonths(today, 1);
      return { start: f(startOfMonth(last)), end: f(endOfMonth(last)) };
    }
    default:
      return { start: f(today), end: f(today) };
  }
}

const TYPE_FILTER_ITEMS = [
  { value: "all", label: "Semua jenis" },
  { value: "CHECK_IN", label: "Check In" },
  { value: "CHECK_OUT", label: "Check Out" },
  { value: "SICK", label: "Sakit" },
  { value: "PERMISSION", label: "Izin" },
];

function RekapTab() {
  const [preset, setPreset] = useState<RangePreset>("today");
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [records, setRecords] = useState<ApiRecord[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [cleanupOpen, setCleanupOpen] = useState(false);

  // `loading` diturunkan dari perbandingan signature — tidak perlu setState
  // sinkron di dalam effect.
  const filterSig = `${startDate}|${endDate}|${typeFilter}|${reloadKey}`;
  const [loadedSig, setLoadedSig] = useState<string | null>(null);
  const loading = loadedSig !== filterSig;

  // Pilih preset rentang tanggal — set preset + tanggal sekaligus (tanpa effect).
  const selectPreset = (key: RangePreset) => {
    setPreset(key);
    if (key !== "custom") {
      const { start, end } = presetRange(key);
      setStartDate(start);
      setEndDate(end);
    }
  };

  // Ambil data saat filter berubah. Semua setState ada di callback async
  // (bukan sinkron di body effect) agar tidak memicu cascading render.
  useEffect(() => {
    let active = true;
    const params = new URLSearchParams();
    if (startDate === endDate) params.set("date", startDate);
    else {
      params.set("startDate", startDate);
      params.set("endDate", endDate);
    }
    if (typeFilter !== "all") params.set("type", typeFilter);

    const sig = `${startDate}|${endDate}|${typeFilter}|${reloadKey}`;
    fetch(`/api/attendance?${params}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: ApiRecord[]) => {
        if (!active) return;
        setRecords(Array.isArray(data) ? data : []);
        setLoadedSig(sig);
      })
      .catch(() => {
        if (!active) return;
        setRecords([]);
        setLoadedSig(sig);
      });

    return () => {
      active = false;
    };
  }, [startDate, endDate, typeFilter, reloadKey]);

  const filtered = records.filter((r) => {
    const name = r.user.name?.trim() || r.user.email;
    return search
      ? name.toLowerCase().includes(search.toLowerCase())
      : true;
  });

  const handleExport = () => {
    window.open(
      `/api/attendance/export?startDate=${startDate}&endDate=${endDate}`,
      "_blank",
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              {RANGE_PRESETS.map((p) => (
                <Button
                  key={p.key}
                  size="sm"
                  variant={preset === p.key ? "default" : "outline"}
                  onClick={() => selectPreset(p.key)}
                >
                  {p.key === "custom" ? <Calendar /> : null}
                  {p.label}
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setCleanupOpen(true)}>
                <Trash2 />
                Bersihkan Data Lama
              </Button>
              <Button size="sm" variant="outline" onClick={handleExport}>
                <Download />
                Export CSV
              </Button>
            </div>
          </div>

          {preset === "custom" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <span className="text-sm font-medium">Dari tanggal</span>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <span className="text-sm font-medium">Sampai tanggal</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <span className="text-sm font-medium">Jenis absensi</span>
              <Select
                value={typeFilter}
                items={TYPE_FILTER_ITEMS}
                onValueChange={(v) => setTypeFilter(v ?? "all")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_FILTER_ITEMS.map((it) => (
                    <SelectItem key={it.value} value={it.value}>
                      {it.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <span className="text-sm font-medium">Cari nama</span>
              <Input
                placeholder="Cari karyawan…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {loading ? "Memuat…" : `${filtered.length} catatan`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              Memuat data…
            </p>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              Tidak ada data absensi pada rentang ini.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Waktu</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>Peran</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Akurasi</TableHead>
                    <TableHead>Keterangan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {format(new Date(`${r.date}T00:00:00`), "dd/MM/yy")}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {format(new Date(r.timestamp), "HH:mm:ss")}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {r.user.name?.trim() || r.user.email}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {effectiveRoleLabel({
                          role: r.user.role,
                          customRole: r.user.customRole,
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={TYPE_BADGE[r.type] ?? "outline"}>
                          {ATTENDANCE_TYPE_LABELS[r.type]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.type === "SICK" || r.type === "PERMISSION" ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          `${Math.round(r.confidence * 100)}%`
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[220px] truncate text-sm">
                        {r.reason || detailSummary(r) || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CleanupDialog
        open={cleanupOpen}
        onOpenChange={setCleanupOpen}
        onCleaned={() => setReloadKey((k) => k + 1)}
      />
    </div>
  );
}

function detailSummary(r: ApiRecord): string | null {
  const raw = r.type === "CHECK_IN" ? r.todoList : r.completedTasks;
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw) as unknown;
    if (Array.isArray(arr) && arr.length > 0) {
      return `${arr.length} item: ${arr.map(String).join(", ")}`;
    }
  } catch {
    /* abaikan */
  }
  return null;
}

/* ------------------------------ Cleanup dialog ----------------------------- */

const CLEANUP_ITEMS = [
  { value: "3", label: "3 bulan lalu" },
  { value: "6", label: "6 bulan lalu" },
  { value: "12", label: "12 bulan lalu" },
  { value: "custom", label: "Pilih tanggal…" },
];

function CleanupDialog({
  open,
  onOpenChange,
  onCleaned,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCleaned: () => void;
}) {
  const [mode, setMode] = useState("3");
  const [customDate, setCustomDate] = useState("");
  const [loading, setLoading] = useState(false);

  const beforeDate =
    mode === "custom"
      ? customDate
      : format(subMonths(new Date(), Number(mode)), "yyyy-MM-dd");

  const label =
    beforeDate
      ? format(new Date(`${beforeDate}T00:00:00`), "d MMMM yyyy", {
          locale: idLocale,
        })
      : "";

  const run = async () => {
    if (!beforeDate) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/attendance?beforeDate=${beforeDate}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { deleted?: number; error?: string };
      if (res.ok) {
        toast.success(`${data.deleted ?? 0} catatan lama dihapus`);
        onOpenChange(false);
        onCleaned();
      } else {
        toast.error(data.error || "Gagal menghapus data");
      }
    } catch {
      toast.error("Gagal terhubung ke server");
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="size-5" />
            Bersihkan Data Absensi Lama
          </DialogTitle>
          <DialogDescription>
            Hapus catatan absensi lama secara permanen. Tindakan ini tidak bisa
            dibatalkan.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-1">
          <div className="space-y-1">
            <span className="text-sm font-medium">Hapus data sebelum</span>
            <Select
              value={mode}
              items={CLEANUP_ITEMS}
              onValueChange={(v) => setMode(v ?? "3")}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLEANUP_ITEMS.map((it) => (
                  <SelectItem key={it.value} value={it.value}>
                    {it.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {mode === "custom" ? (
            <div className="space-y-1">
              <span className="text-sm font-medium">Sebelum tanggal</span>
              <Input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
              />
            </div>
          ) : null}

          {beforeDate ? (
            <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-3">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Semua catatan sebelum <strong>{label}</strong> akan dihapus
                permanen.
              </p>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button
            variant="destructive"
            onClick={run}
            disabled={loading || !beforeDate}
          >
            {loading ? <Loader2 className="animate-spin" /> : <Trash2 />}
            Hapus Data
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/*                               Registrasi tab                              */
/* -------------------------------------------------------------------------- */

function RegistrasiTab({ rows }: { rows: RegistrationRow[] }) {
  const [list, setList] = useState(rows);
  const [resetId, setResetId] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  const target = list.find((r) => r.id === resetId) ?? null;

  const doReset = async () => {
    if (!resetId) return;
    setResetting(true);
    try {
      const res = await fetch(`/api/face-data?userId=${resetId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setList((prev) =>
          prev.map((r) => (r.id === resetId ? { ...r, faceCount: 0 } : r)),
        );
        toast.success("Data wajah berhasil direset");
        setResetId(null);
      } else {
        const data = (await res.json()) as { error?: string };
        toast.error(data.error || "Gagal mereset data wajah");
      }
    } catch {
      toast.error("Gagal terhubung ke server");
    }
    setResetting(false);
  };

  const registered = list.filter((r) => r.faceCount > 0).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="size-4" />
          Registrasi Wajah Karyawan
        </CardTitle>
        <p className="text-muted-foreground text-sm">
          {registered} dari {list.length} pengguna sudah mendaftarkan wajah.
          Karyawan mendaftarkan wajahnya sendiri lewat menu Absensi.
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Peran</TableHead>
                <TableHead>Status Wajah</TableHead>
                <TableHead>Total Absen</TableHead>
                <TableHead>Absen Terakhir</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <p className="text-sm font-medium">{r.name}</p>
                    <p className="text-muted-foreground text-xs">{r.email}</p>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {r.role}
                  </TableCell>
                  <TableCell>
                    {r.faceCount > 0 ? (
                      <Badge variant="default">
                        <UserCheck className="size-3" />
                        Terdaftar
                      </Badge>
                    ) : (
                      <Badge variant="outline">Belum daftar</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">
                    {r.attendanceCount}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {r.lastDate
                      ? format(
                          new Date(`${r.lastDate}T00:00:00`),
                          "d MMM yyyy",
                          { locale: idLocale },
                        )
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={r.faceCount === 0}
                      onClick={() => setResetId(r.id)}
                    >
                      <Trash2 />
                      Reset
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog
        open={!!resetId}
        onOpenChange={(v) => {
          if (!v) setResetId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Data Wajah</DialogTitle>
            <DialogDescription>
              Data wajah <strong>{target?.name}</strong> akan dihapus. Yang
              bersangkutan harus mendaftarkan wajah ulang sebelum bisa absen
              lagi.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResetId(null)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={doReset}
              disabled={resetting}
            >
              {resetting ? <Loader2 className="animate-spin" /> : <Trash2 />}
              Reset Wajah
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
