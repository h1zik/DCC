"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { toast } from "sonner";
import {
  ScanFace,
  LogIn,
  LogOut,
  Thermometer,
  FileText,
  ChevronDown,
  ChevronUp,
  Loader2,
  Send,
  UserCheck,
  ShieldCheck,
} from "lucide-react";
import { PageHero, PageHeroChip } from "@/components/page-hero";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ATTENDANCE_TYPE_LABELS } from "@/lib/attendance-constants";
import { FaceEnroll } from "@/components/attendance/face-enroll";
import { FaceCheck } from "@/components/attendance/face-check";
import type { AttendanceClientProps } from "./attendance-client";
import type { AttendanceRow } from "./types";

type View = "home" | "enroll" | "checkin" | "checkout" | "sick" | "permission";

const TYPE_BADGE: Record<
  AttendanceRow["type"],
  "default" | "secondary" | "outline"
> = {
  CHECK_IN: "default",
  CHECK_OUT: "secondary",
  SICK: "outline",
  PERMISSION: "outline",
};

function fmtTime(iso: string) {
  return format(new Date(iso), "HH:mm");
}
function fmtDate(date: string) {
  return format(new Date(`${date}T00:00:00`), "EEE, d MMM yyyy", {
    locale: idLocale,
  });
}

export function AttendancePanel({
  hasFace,
  userName,
  todayRows,
  historyRows,
}: AttendanceClientProps) {
  const router = useRouter();
  const [view, setView] = useState<View>("home");

  const backHome = () => setView("home");
  const refreshHome = () => {
    router.refresh();
    setView("home");
  };

  // Status hari ini (todayRows terurut terbaru lebih dulu).
  const checkIn = todayRows.find((r) => r.type === "CHECK_IN");
  const checkOut = todayRows.find((r) => r.type === "CHECK_OUT");
  const sick = todayRows.find((r) => r.type === "SICK");
  const permission = todayRows.find((r) => r.type === "PERMISSION");

  const heroChips = (
    <>
      {checkIn ? (
        <PageHeroChip>
          <LogIn className="size-3 text-emerald-500" />
          Masuk {fmtTime(checkIn.timestamp)}
        </PageHeroChip>
      ) : null}
      {checkOut ? (
        <PageHeroChip>
          <LogOut className="size-3 text-blue-500" />
          Pulang {fmtTime(checkOut.timestamp)}
        </PageHeroChip>
      ) : null}
      {sick ? <PageHeroChip>Sakit tercatat</PageHeroChip> : null}
      {permission ? <PageHeroChip>Izin tercatat</PageHeroChip> : null}
      {!checkIn && !checkOut && !sick && !permission ? (
        <PageHeroChip>Belum absen hari ini</PageHeroChip>
      ) : null}
    </>
  );

  return (
    <>
      <PageHero
        icon={ScanFace}
        variant="compact"
        title="Absensi"
        subtitle="Scan wajah untuk mencatat kehadiran. Wajah Anda diverifikasi dengan data Anda sendiri (1:1) — aman dari titip absen."
        right={heroChips}
      />

      {view === "home" && (
        <HomeView
          hasFace={hasFace}
          checkedIn={!!checkIn}
          checkedOut={!!checkOut}
          onAction={(v) => setView(v)}
          historyRows={historyRows}
        />
      )}

      {view === "enroll" && (
        <FaceEnroll
          reenroll={hasFace}
          onDone={() => {
            toast.success("Data wajah berhasil disimpan");
            refreshHome();
          }}
          onCancel={backHome}
        />
      )}

      {(view === "checkin" || view === "checkout") && (
        <FaceCheck
          key={view}
          type={view === "checkin" ? "CHECK_IN" : "CHECK_OUT"}
          userName={userName}
          onDone={() => {
            toast.success(
              view === "checkin"
                ? "Check-in berhasil dicatat"
                : "Check-out berhasil dicatat",
            );
            refreshHome();
          }}
          onCancel={backHome}
        />
      )}

      {(view === "sick" || view === "permission") && (
        <AbsenceForm
          key={view}
          type={view === "sick" ? "SICK" : "PERMISSION"}
          onDone={() => {
            toast.success(
              view === "sick" ? "Catatan sakit terkirim" : "Catatan izin terkirim",
            );
            refreshHome();
          }}
          onCancel={backHome}
        />
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  Home view                                */
/* -------------------------------------------------------------------------- */

function HomeView({
  hasFace,
  checkedIn,
  checkedOut,
  onAction,
  historyRows,
}: {
  hasFace: boolean;
  checkedIn: boolean;
  checkedOut: boolean;
  onAction: (v: View) => void;
  historyRows: AttendanceRow[];
}) {
  // Sudah check-in tapi belum check-out → tampilkan tombol Check Out saja.
  // Selain itu (belum check-in, atau sudah pulang) → tampilkan Check In saja.
  const showCheckOut = checkedIn && !checkedOut;

  return (
    <div className="flex flex-col gap-6">
      {!hasFace ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary">
              <UserCheck className="size-7" />
            </span>
            <div className="space-y-1">
              <p className="text-base font-semibold">
                Wajah Anda belum terdaftar
              </p>
              <p className="text-muted-foreground mx-auto max-w-md text-sm">
                Daftarkan wajah Anda terlebih dahulu. Cukup sekali — setelah itu
                Anda bisa check-in & check-out cukup dengan scan wajah.
              </p>
            </div>
            <Button size="lg" onClick={() => onAction("enroll")}>
              <ScanFace />
              Daftarkan Wajah Sekarang
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Catat Absensi</CardTitle>
            <CardDescription>
              Pilih jenis absensi. Check-in & check-out memerlukan scan wajah.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {/* Check In hanya muncul saat belum check-in (atau sudah pulang),
                  Check Out hanya saat sudah check-in tapi belum pulang — supaya
                  tidak terjadi salah input / kepencet dua kali. */}
              {showCheckOut ? (
                <ActionButton
                  icon={LogOut}
                  label="Check Out"
                  hint="Selesai kerja"
                  tone="blue"
                  onClick={() => onAction("checkout")}
                />
              ) : (
                <ActionButton
                  icon={LogIn}
                  label="Check In"
                  hint="Mulai kerja"
                  tone="emerald"
                  onClick={() => onAction("checkin")}
                />
              )}
              <ActionButton
                icon={Thermometer}
                label="Sakit"
                hint="Tanpa scan"
                tone="amber"
                onClick={() => onAction("sick")}
              />
              <ActionButton
                icon={FileText}
                label="Izin"
                hint="Tanpa scan"
                tone="violet"
                onClick={() => onAction("permission")}
              />
            </div>
            <div className="flex items-center gap-2 border-t border-border pt-3">
              <ShieldCheck className="text-muted-foreground size-3.5" />
              <span className="text-muted-foreground text-xs">
                Wajah Anda sudah terdaftar.
              </span>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs"
                onClick={() => onAction("enroll")}
              >
                Perbarui data wajah
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <HistoryCard rows={historyRows} />
    </div>
  );
}

const TONE_CLASS: Record<string, string> = {
  emerald:
    "hover:border-emerald-500/50 hover:bg-emerald-500/5 [&_svg]:text-emerald-500",
  blue: "hover:border-blue-500/50 hover:bg-blue-500/5 [&_svg]:text-blue-500",
  amber: "hover:border-amber-500/50 hover:bg-amber-500/5 [&_svg]:text-amber-500",
  violet:
    "hover:border-violet-500/50 hover:bg-violet-500/5 [&_svg]:text-violet-500",
};

function ActionButton({
  icon: Icon,
  label,
  hint,
  tone,
  onClick,
}: {
  icon: typeof LogIn;
  label: string;
  hint: string;
  tone: keyof typeof TONE_CLASS;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center transition-all active:translate-y-px",
        TONE_CLASS[tone],
      )}
    >
      <Icon className="size-7" />
      <span className="text-sm font-semibold">{label}</span>
      <span className="text-muted-foreground text-[11px]">{hint}</span>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*                                History card                               */
/* -------------------------------------------------------------------------- */

function HistoryCard({ rows }: { rows: AttendanceRow[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (recordId: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(recordId)) next.delete(recordId);
      else next.add(recordId);
      return next;
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Riwayat Absensi Saya</CardTitle>
        <CardDescription>{rows.length} catatan terakhir.</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            Belum ada catatan absensi.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Waktu</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Akurasi</TableHead>
                  <TableHead>Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const detail = recordDetail(r);
                  const isOpen = expanded.has(r.id);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">
                        {fmtDate(r.date)}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {fmtTime(r.timestamp)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={TYPE_BADGE[r.type]}>
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
                      <TableCell>
                        {detail ? (
                          <div>
                            <button
                              type="button"
                              onClick={() => toggle(r.id)}
                              className="text-primary flex cursor-pointer items-center gap-1 text-sm hover:underline"
                            >
                              {isOpen ? (
                                <ChevronUp className="size-3.5" />
                              ) : (
                                <ChevronDown className="size-3.5" />
                              )}
                              {isOpen ? "Tutup" : "Lihat"}
                            </button>
                            {isOpen ? (
                              <div className="bg-muted/50 mt-2 rounded-lg p-3">
                                <p className="text-muted-foreground mb-1 text-xs font-semibold">
                                  {detail.label}
                                </p>
                                {detail.items ? (
                                  <ul className="space-y-0.5 text-sm">
                                    {detail.items.map((it, i) => (
                                      <li key={i} className="flex gap-1.5">
                                        <span className="text-muted-foreground">
                                          {i + 1}.
                                        </span>
                                        <span>{it}</span>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-sm">{detail.text}</p>
                                )}
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            —
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function parseList(raw: string | null): string[] | null {
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw) as unknown;
    if (Array.isArray(arr) && arr.length > 0) return arr.map(String);
    return null;
  } catch {
    return null;
  }
}

function recordDetail(
  r: AttendanceRow,
): { label: string; items?: string[]; text?: string } | null {
  if (r.type === "CHECK_IN") {
    const items = parseList(r.todoList);
    return items ? { label: "Rencana kerja", items } : null;
  }
  if (r.type === "CHECK_OUT") {
    const items = parseList(r.completedTasks);
    return items ? { label: "Tugas selesai", items } : null;
  }
  if (r.reason && r.reason.trim()) {
    return { label: "Alasan", text: r.reason };
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/*                          Absence form (Sakit/Izin)                        */
/* -------------------------------------------------------------------------- */

function AbsenceForm({
  type,
  onDone,
  onCancel,
}: {
  type: "SICK" | "PERMISSION";
  onDone: () => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!reason.trim()) {
      setError("Alasan wajib diisi.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, reason: reason.trim() }),
      });
      const data = (await res.json()) as { error?: string };
      if (res.ok) {
        onDone();
      } else {
        setError(data.error || "Gagal menyimpan catatan.");
      }
    } catch {
      setError("Gagal terhubung ke server.");
    }
    setSubmitting(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{type === "SICK" ? "Catatan Sakit" : "Catatan Izin"}</CardTitle>
        <CardDescription>
          {type === "SICK"
            ? "Jelaskan keluhan Anda. Catatan ini langsung tercatat untuk hari ini."
            : "Jelaskan alasan izin Anda. Catatan ini langsung tercatat untuk hari ini."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="space-y-2">
          <Label htmlFor="absence-reason">
            {type === "SICK" ? "Alasan sakit" : "Alasan izin"}
          </Label>
          <Textarea
            id="absence-reason"
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              type === "SICK"
                ? "Contoh: Demam, perlu istirahat di rumah…"
                : "Contoh: Ada keperluan keluarga…"
            }
          />
        </div>
        {error ? (
          <p className="text-destructive text-sm">{error}</p>
        ) : null}
        <div className="flex gap-2">
          <Button onClick={submit} disabled={submitting || !reason.trim()}>
            {submitting ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Send />
            )}
            Kirim Catatan
          </Button>
          <Button variant="ghost" onClick={onCancel} disabled={submitting}>
            Batal
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
