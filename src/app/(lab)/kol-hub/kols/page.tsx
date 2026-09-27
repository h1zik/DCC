import type { Metadata } from "next";
import Link from "next/link";
import { KolStatus } from "@prisma/client";
import { UserPlus, Users } from "lucide-react";
import { LabModulePage } from "@/components/lab/lab-module-page";
import { LabStatChip } from "@/components/lab/lab-primitives";
import { Button } from "@/components/ui/button";
import { getKolStats, listCategories, listKols } from "@/lib/kol/readers";
import { KolListClient } from "./kol-list-client";

export const metadata: Metadata = { title: "Database KOL · KOL Hub" };

const STATUSES = new Set<string>(Object.values(KolStatus));
const TIERS = new Set(["NANO", "MICRO", "MID", "MACRO", "MEGA"]);

export default async function KolDatabasePage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    category?: string;
    platform?: string;
    tier?: string;
  }>;
}) {
  const sp = await searchParams;
  const filters = {
    q: sp.q ?? null,
    status: sp.status && STATUSES.has(sp.status) ? (sp.status as KolStatus) : null,
    categoryId: sp.category || null,
    platform:
      sp.platform === "INSTAGRAM" || sp.platform === "TIKTOK"
        ? (sp.platform as "INSTAGRAM" | "TIKTOK")
        : null,
    tier: sp.tier && TIERS.has(sp.tier) ? sp.tier : null,
  };

  const [rows, stats, categories] = await Promise.all([
    listKols(filters),
    getKolStats(),
    listCategories(),
  ]);

  return (
    <LabModulePage
      icon={Users}
      eyebrow="KOL Hub"
      title="Database KOL"
      description="Semua KOL yang pernah atau akan diajak kerja sama. Hanya KOL aktif yang bisa dijadwalkan."
      right={
        <Button size="sm" render={<Link href="/kol-hub/kols/new" />}>
          <UserPlus />
          Tambah KOL
        </Button>
      }
      footer={
        <div className="flex flex-wrap gap-2">
          <LabStatChip label="Aktif" value={stats.active} tone="success" />
          <LabStatChip label="Menunggu approval" value={stats.waiting} tone="warning" />
          <LabStatChip label="Blacklist" value={stats.blacklisted} tone="danger" />
          <LabStatChip label="Pengajuan perubahan" value={stats.pendingChanges} />
        </div>
      }
    >
      <KolListClient
        rows={rows}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      />
    </LabModulePage>
  );
}
