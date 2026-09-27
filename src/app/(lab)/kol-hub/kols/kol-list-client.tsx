"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Search, UserPlus, Users } from "lucide-react";
import { InfluencerVerdict } from "@prisma/client";
import { compactNumber, VerdictBadge } from "@/components/brand-hub/influencer-badges";
import { KolBadge, KolStatusBadge, PlatformMark } from "@/components/kol-hub/kol-badges";
import { KolSelect } from "@/components/kol-hub/kol-fields";
import { useUrlFilters } from "@/components/kol-hub/use-url-filters";
import { LabCard, LabEmptyState, LabToolbar } from "@/components/lab/lab-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { rupiahShort } from "@/lib/kol/format";
import {
  KOL_CHANGE_TYPE_LABEL,
  KOL_STATUS_META,
  TIER_LABEL,
  type KolChangeTypeValue,
} from "@/lib/kol/labels";
import type { KolListRow } from "@/lib/kol/readers";
import { cn } from "@/lib/utils";

export function KolListClient({
  rows,
  categories,
}: {
  rows: KolListRow[];
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const { get, set, pending } = useUrlFilters();
  const [q, setQ] = useState(get("q"));

  // Debounce pencarian supaya tidak push URL tiap ketukan.
  useEffect(() => {
    if (q === get("q")) return;
    const t = setTimeout(() => set({ q }), 300);
    return () => clearTimeout(t);
  }, [q, get, set]);

  const hasFilter = ["q", "status", "category", "platform", "tier"].some((k) => get(k));

  return (
    <div className="flex flex-col gap-4">
      <LabToolbar>
        <div className="relative min-w-[200px] flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nama atau username…"
            aria-label="Cari KOL"
            className="h-8 pl-8 text-xs"
          />
        </div>
        <KolSelect
          className="h-8 w-[170px] text-xs"
          ariaLabel="Filter status"
          value={get("status")}
          onChange={(v) => set({ status: v })}
          emptyLabel="Semua status"
          options={Object.entries(KOL_STATUS_META).map(([value, m]) => ({
            value,
            label: m.label,
          }))}
        />
        <KolSelect
          className="h-8 w-[160px] text-xs"
          ariaLabel="Filter kategori"
          value={get("category")}
          onChange={(v) => set({ category: v })}
          emptyLabel="Semua kategori"
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
        />
        <KolSelect
          className="h-8 w-[140px] text-xs"
          ariaLabel="Filter platform"
          value={get("platform")}
          onChange={(v) => set({ platform: v })}
          emptyLabel="Semua platform"
          options={[
            { value: "INSTAGRAM", label: "Instagram" },
            { value: "TIKTOK", label: "TikTok" },
          ]}
        />
        <KolSelect
          className="h-8 w-[130px] text-xs"
          ariaLabel="Filter tier"
          value={get("tier")}
          onChange={(v) => set({ tier: v })}
          emptyLabel="Semua tier"
          options={Object.entries(TIER_LABEL).map(([value, label]) => ({ value, label }))}
        />
        {hasFilter ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQ("");
              set({ q: null, status: null, category: null, platform: null, tier: null });
            }}
          >
            Reset
          </Button>
        ) : null}
      </LabToolbar>

      {rows.length === 0 ? (
        <LabEmptyState
          icon={Users}
          title={hasFilter ? "Tidak ada KOL yang cocok" : "Database KOL masih kosong"}
          description={
            hasFilter
              ? "Longgarkan filter atau cari dengan nama lain."
              : "Tambahkan KOL pertama, atau ambil dari KOL Radar & Audit Influencer di Brand Hub."
          }
          action={
            hasFilter ? undefined : (
              <Button size="sm" render={<Link href="/kol-hub/kols/new" />}>
                <UserPlus />
                Tambah KOL
              </Button>
            )
          }
        />
      ) : (
        <LabCard className={cn("overflow-x-auto p-0", pending && "opacity-70")}>
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="text-muted-foreground border-b border-border/70 text-left text-[11px]">
                <th className="px-4 py-2.5 font-medium">KOL</th>
                <th className="px-3 py-2.5 font-medium">Akun</th>
                <th className="px-3 py-2.5 font-medium">Keaslian</th>
                <th className="px-3 py-2.5 text-right font-medium">Rate card</th>
                <th className="px-3 py-2.5 text-right font-medium">Jadwal</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {rows.map((k) => {
                const primary = k.accounts[0];
                return (
                  <tr
                    key={k.id}
                    className="hover:bg-muted/40 cursor-pointer transition-colors"
                    onClick={() => router.push(`/kol-hub/kols/${k.id}`)}
                  >
                    <td className="px-4 py-3 align-top">
                      <Link
                        href={`/kol-hub/kols/${k.id}`}
                        className="font-semibold hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {k.fullName}
                      </Link>
                      {k.categories.length ? (
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          {k.categories.map((c) => c.name).join(", ")}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <ul className="flex flex-col gap-1">
                        {k.accounts.map((a) => (
                          <li key={a.id} className="flex items-center gap-1.5 text-xs">
                            <PlatformMark platform={a.platform} />
                            <span className="font-medium">@{a.handle}</span>
                            {a.followers != null ? (
                              <span className="text-muted-foreground tabular-nums">
                                {compactNumber(a.followers)}
                              </span>
                            ) : null}
                            {a.tier ? (
                              <span className="text-muted-foreground">
                                · {TIER_LABEL[a.tier] ?? a.tier}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <VerdictBadge
                        verdict={(primary?.audit?.verdict as InfluencerVerdict | null) ?? null}
                      />
                    </td>
                    <td className="px-3 py-3 text-right align-top tabular-nums">
                      {primary?.rateCard != null ? rupiahShort(primary.rateCard) : "—"}
                    </td>
                    <td className="px-3 py-3 text-right align-top tabular-nums">
                      {k.scheduleCount}
                      {k.postedCount ? (
                        <span className="text-muted-foreground text-xs">
                          {" "}
                          ({k.postedCount} tayang)
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-wrap gap-1">
                        <KolStatusBadge status={k.status} />
                        {k.pendingChange && k.pendingChange !== "CREATE" ? (
                          <KolBadge tone="warning">
                            {KOL_CHANGE_TYPE_LABEL[k.pendingChange as KolChangeTypeValue]} menunggu
                          </KolBadge>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </LabCard>
      )}
    </div>
  );
}
