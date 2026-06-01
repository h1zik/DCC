"use client";

import dynamic from "next/dynamic";
import { ScanFace } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { Skeleton } from "@/components/ui/skeleton";
import type { AttendanceRow } from "./types";

/**
 * Wrapper client untuk memuat panel absensi tanpa SSR — face-api & kamera
 * hanya berjalan di browser.
 */
const AttendancePanel = dynamic(
  () => import("./attendance-panel").then((m) => m.AttendancePanel),
  {
    ssr: false,
    loading: () => (
      <>
        <PageHero
          icon={ScanFace}
          title="Absensi"
          subtitle="Memuat modul pengenalan wajah…"
        />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </>
    ),
  },
);

export interface AttendanceClientProps {
  hasFace: boolean;
  userName: string;
  todayRows: AttendanceRow[];
  historyRows: AttendanceRow[];
}

export function AttendanceClient(props: AttendanceClientProps) {
  return <AttendancePanel {...props} />;
}
