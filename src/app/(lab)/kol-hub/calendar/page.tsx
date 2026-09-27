import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import { LabModulePage } from "@/components/lab/lab-module-page";
import { listBrandOptions, listCalendarSchedules } from "@/lib/kol/readers";
import { KolCalendarClient } from "./calendar-client";

export const metadata: Metadata = { title: "Kalender · KOL Hub" };

function currentWibMonth(): string {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 7);
}

export default async function KolCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; brand?: string; platform?: string; placement?: string }>;
}) {
  const sp = await searchParams;
  const month = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : currentWibMonth();
  const [y, m] = month.split("-").map(Number);
  // Rentang grid: seminggu sebelum & sesudah bulan agar sel tepi ikut terisi.
  const from = new Date(Date.UTC(y, m - 1, 1, -7) - 7 * 86400_000);
  const to = new Date(Date.UTC(y, m, 1, -7) + 7 * 86400_000);

  const [rows, brands] = await Promise.all([
    listCalendarSchedules({
      from,
      to,
      brandId: sp.brand || null,
      platform:
        sp.platform === "INSTAGRAM" || sp.platform === "TIKTOK"
          ? (sp.platform as "INSTAGRAM" | "TIKTOK")
          : null,
      placement: sp.placement || null,
    }),
    listBrandOptions(),
  ]);

  return (
    <LabModulePage
      icon={CalendarDays}
      eyebrow="KOL Hub"
      title="Kalender tayang"
      description="Sebaran jadwal per hari (WIB). Draf dan menunggu approval tampil pudar — belum pasti tayang."
    >
      <KolCalendarClient
        month={month}
        brands={brands}
        events={rows.map((r) => ({
          id: r.id,
          scheduledAt: r.scheduledAt!,
          status: r.status,
          platform: r.platform,
          placement: r.placement,
          handle: r.handle,
          kolName: r.kolName,
          brandName: r.brandName,
          campaignTitle: r.campaignTitle,
        }))}
      />
    </LabModulePage>
  );
}
