import type { Metadata } from "next";
import Link from "next/link";
import { KolScheduleStatus } from "@prisma/client";
import { CalendarPlus, ClipboardList } from "lucide-react";
import { LabModulePage } from "@/components/lab/lab-module-page";
import { Button } from "@/components/ui/button";
import {
  getScheduleStatusCounts,
  listBrandOptions,
  listCampaigns,
  listSchedules,
} from "@/lib/kol/readers";
import { SchedulesClient } from "./schedules-client";

export const metadata: Metadata = { title: "Jadwal · KOL Hub" };

const STATUSES = new Set<string>(Object.values(KolScheduleStatus));

export default async function KolSchedulesPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    brand?: string;
    campaign?: string;
    platform?: string;
    q?: string;
  }>;
}) {
  const sp = await searchParams;
  const base = {
    brandId: sp.brand || null,
    campaignId: sp.campaign || null,
    q: sp.q || null,
    platform:
      sp.platform === "INSTAGRAM" || sp.platform === "TIKTOK"
        ? (sp.platform as "INSTAGRAM" | "TIKTOK")
        : null,
  };
  const status =
    sp.status && STATUSES.has(sp.status) ? (sp.status as KolScheduleStatus) : null;

  const [rows, counts, brands, campaigns] = await Promise.all([
    listSchedules({ ...base, status }),
    getScheduleStatusCounts(base),
    listBrandOptions(),
    listCampaigns(),
  ]);

  return (
    <LabModulePage
      icon={ClipboardList}
      eyebrow="KOL Hub"
      title="Jadwal endorsement"
      description="Setiap baris satu konten. Status persetujuan, tayang, dan kirim produk dilacak terpisah."
      right={
        <Button size="sm" render={<Link href="/kol-hub/schedules/new" />}>
          <CalendarPlus />
          Buat jadwal
        </Button>
      }
    >
      <SchedulesClient
        rows={rows}
        counts={counts}
        brands={brands}
        campaigns={campaigns.map((c) => ({ id: c.id, title: c.title, brandId: c.brandId }))}
      />
    </LabModulePage>
  );
}
