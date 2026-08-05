"use client";

import { useState } from "react";
import { ChevronDown, ScrollText } from "lucide-react";
import { InfluencerTier } from "@prisma/client";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { lab } from "@/components/lab/lab-primitives";
import { TIER_LABEL } from "@/components/brand-hub/influencer-badges";
import { cn } from "@/lib/utils";

/**
 * Menjelaskan cara skor influencer dihitung, memakai angka audit ini sendiri.
 *
 * Panel ini bukan basa-basi: penilaian otomatis yang tidak bisa ditelusuri
 * tidak layak dipakai untuk memutuskan pembayaran. Setiap komponen ditampilkan
 * beserta bobot dan kontribusinya agar angka akhirnya bisa diperiksa manual.
 */

export type MethodologyAudit = {
  tier: InfluencerTier | null;
  benchmarkEr: number | null;
  engagementRate: number;
  postsFetched: number;
  postsAnalyzed: number;
  sampleWindowDays: number | null;
  confidence: string;
  score: number;
  authenticityScore: number;
  postsPerWeek: number;
  daysSinceLastPost: number | null;
  viewRate: number | null;
  sponsoredCount: number;
  organicCount: number;
};

type Components = {
  engagement: number;
  consistency: number;
  reach: number;
  authenticity: number;
  performancePenalty: number;
};

const WEIGHTS = {
  engagement: 0.45,
  consistency: 0.2,
  reach: 0.2,
  authenticity: 0.15,
} as const;

function num(value: number, digits = 1): string {
  return value.toLocaleString("id-ID", { maximumFractionDigits: digits });
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span className="bg-[color-mix(in_srgb,var(--lab-accent,var(--primary))_14%,transparent)] text-[var(--lab-accent,var(--primary))] flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-foreground text-sm font-semibold">{title}</p>
        <div className="text-muted-foreground mt-1 space-y-1.5 text-xs leading-relaxed">
          {children}
        </div>
      </div>
    </div>
  );
}

function ComponentRow({
  label,
  value,
  weight,
  hint,
}: {
  label: string;
  value: number;
  weight: number;
  hint: string;
}) {
  return (
    <tr className="border-border/50 border-t">
      <td className="py-2 pr-3">
        <p className="text-foreground font-medium">{label}</p>
        <p className="text-muted-foreground text-[11px] leading-snug">{hint}</p>
      </td>
      <td className="py-2 pr-3 text-right tabular-nums">{num(value)}</td>
      <td className="text-muted-foreground py-2 pr-3 text-right tabular-nums">
        ×{weight}
      </td>
      <td className="text-foreground py-2 text-right font-semibold tabular-nums">
        {num(value * weight)}
      </td>
    </tr>
  );
}

export function InfluencerMethodology({
  audit,
  components,
}: {
  audit: MethodologyAudit;
  components: Components | null;
}) {
  const [open, setOpen] = useState(false);

  const subtotal = components
    ? components.engagement * WEIGHTS.engagement +
      components.consistency * WEIGHTS.consistency +
      components.reach * WEIGHTS.reach +
      components.authenticity * WEIGHTS.authenticity
    : null;
  const capped =
    subtotal !== null &&
    Math.round(subtotal - (components?.performancePenalty ?? 0)) > audit.score;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        className={cn(
          lab.nestedPanel,
          "flex w-full items-center justify-between gap-3 text-left transition-colors hover:bg-muted/40",
        )}
      >
        <span className="flex items-center gap-2.5">
          <ScrollText
            className="size-4 text-[var(--lab-accent,var(--primary))]"
            aria-hidden
          />
          <span>
            <span className="text-foreground block text-sm font-semibold">
              Bagaimana penilaian ini dibuat
            </span>
            <span className="text-muted-foreground block text-xs">
              Rumus, ambang batas, dan rincian skor influencer ini
            </span>
          </span>
        </span>
        <ChevronDown
          className={cn(
            "text-muted-foreground size-4 shrink-0 transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </CollapsibleTrigger>

      <CollapsiblePanel>
        <div className={cn(lab.nestedPanel, "mt-2 flex flex-col gap-5")}>
          <Step n={1} title="Memilih post yang dinilai">
            <p>
              Dari <strong>{audit.postsFetched} post</strong> yang diambil,{" "}
              <strong>{audit.postsAnalyzed}</strong> dipakai — hanya yang
              diposting dalam <strong>180 hari terakhir</strong>
              {audit.sampleWindowDays !== null ? (
                <> (sampel mencakup {audit.sampleWindowDays} hari)</>
              ) : null}
              .
            </p>
            <p>
              Batas waktu ini sekaligus menyingkirkan post yang dipin, yang di
              Instagram ikut terbawa di daftar terbaru walau berumur tahunan.
              Kalau post terbaru kurang dari 6, semua post dipakai dan tingkat
              keyakinan diturunkan.
            </p>
          </Step>

          <Step n={2} title="Menghitung engagement rate">
            <p>
              <code className="bg-muted rounded px-1 py-0.5 text-[11px]">
                ER = median(like + komentar) ÷ follower × 100
              </code>
            </p>
            <p>
              Dipakai <strong>median</strong>, bukan rata-rata, supaya satu post
              viral tidak menaikkan angka jauh di atas performa normalnya.
              Hanya like dan komentar yang dihitung di sini karena angka
              pembanding industri memakai definisi yang sama — share dan simpan
              dilaporkan terpisah sebagai &ldquo;ER penuh&rdquo;.
            </p>
          </Step>

          <Step n={3} title="Membandingkan dengan tier follower, bukan angka mutlak">
            <p>
              ER influencer ini <strong>{num(audit.engagementRate, 2)}%</strong>{" "}
              dibandingkan median tier{" "}
              <strong>
                {audit.tier ? TIER_LABEL[audit.tier] : "—"}
              </strong>{" "}
              sebesar <strong>{num(audit.benchmarkEr ?? 0, 2)}%</strong>.
            </p>
            <p>
              ER 3% pada akun 5 ribu follower sama sekali tidak sebanding dengan
              3% pada akun 1 juta follower, jadi angka mutlak tidak dipakai.
              Acuan Instagram dan TikTok juga dipisah karena feed TikTok
              berbasis rekomendasi, bukan graf follower.
            </p>
          </Step>

          <Step n={4} title="Memeriksa tanda engagement dibeli">
            <p>Ambang yang dipakai:</p>
            <ul className="list-disc space-y-0.5 pl-4">
              <li>Komentar di bawah 0,4% dari like → pola like berbayar</li>
              <li>Komentar di atas 20% dari like → engagement pod / bot</li>
              <li>View di bawah 10% follower → follower tidak aktif</li>
              <li>
                Variasi engagement antar post di bawah 15% → terlalu seragam
                untuk akun organik
              </li>
              <li>Mengikuti lebih banyak dari pengikutnya → taktik follow/unfollow</li>
            </ul>
            <p>
              Tiap temuan memotong skor keaslian (berat 30, sedang 18). Skor
              keaslian influencer ini{" "}
              <strong>{audit.authenticityScore}/100</strong>.
            </p>
          </Step>

          <Step n={5} title="Memisahkan post berbayar dari organik">
            <p>
              Terdeteksi <strong>{audit.sponsoredCount} post berbayar</strong>{" "}
              dan <strong>{audit.organicCount} organik</strong>. Post endorse
              hampir selalu lebih rendah engagement-nya, dan angka itulah yang
              akan brand dapatkan — bukan rata-rata semua post.
            </p>
          </Step>

          {components ? (
            <Step n={6} title="Menjumlahkan skor akhir">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[380px] text-xs">
                  <thead>
                    <tr className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
                      <th className="pb-1 text-left">Komponen</th>
                      <th className="pb-1 text-right">Nilai</th>
                      <th className="pb-1 text-right">Bobot</th>
                      <th className="pb-1 text-right">Kontribusi</th>
                    </tr>
                  </thead>
                  <tbody>
                    <ComponentRow
                      label="Engagement"
                      hint="ER dibanding median tier"
                      value={components.engagement}
                      weight={WEIGHTS.engagement}
                    />
                    <ComponentRow
                      label="Konsistensi"
                      hint={`${num(audit.postsPerWeek)} post/minggu, terakhir ${audit.daysSinceLastPost ?? "?"} hari lalu`}
                      value={components.consistency}
                      weight={WEIGHTS.consistency}
                    />
                    <ComponentRow
                      label="Jangkauan"
                      hint={
                        audit.viewRate !== null
                          ? `View ${num(audit.viewRate)}% dari follower`
                          : "Tanpa data view — dinilai netral"
                      }
                      value={components.reach}
                      weight={WEIGHTS.reach}
                    />
                    <ComponentRow
                      label="Keaslian"
                      hint="Dari sinyal engagement palsu"
                      value={components.authenticity}
                      weight={WEIGHTS.authenticity}
                    />
                    {components.performancePenalty > 0 ? (
                      <tr className="border-border/50 border-t">
                        <td className="py-2 pr-3">
                          <p className="text-foreground font-medium">
                            Potongan performa
                          </p>
                          <p className="text-muted-foreground text-[11px] leading-snug">
                            Mis. engagement anjlok di post berbayar
                          </p>
                        </td>
                        <td colSpan={2} />
                        <td className="py-2 text-right font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                          −{num(components.performancePenalty)}
                        </td>
                      </tr>
                    ) : null}
                    <tr className="border-border border-t-2">
                      <td className="text-foreground py-2 font-bold" colSpan={3}>
                        Skor akhir
                      </td>
                      <td className="text-foreground py-2 text-right text-sm font-extrabold tabular-nums">
                        {audit.score}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {capped ? (
                <p className="mt-2 rounded-lg border border-rose-300/60 bg-rose-50/60 p-2.5 text-[11px] leading-relaxed text-rose-800 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-200">
                  Skor dipotong ke maksimal 45 karena ada sinyal keaslian
                  tingkat berat. Angka engagement yang tinggi justru itulah yang
                  sedang dipertanyakan, jadi tidak boleh tertutup oleh bobot.
                </p>
              ) : null}
            </Step>
          ) : null}

          <Step n={components ? 7 : 6} title="Menentukan vonis">
            <ul className="list-disc space-y-0.5 pl-4">
              <li>
                Ada sinyal keaslian tingkat berat, atau skor keaslian di bawah 50
                → <strong>Mencurigakan</strong> (mengabaikan skor)
              </li>
              <li>Skor 80+ → Sangat bagus</li>
              <li>Skor 65–79 → Bagus</li>
              <li>Skor 45–64 → Rata-rata</li>
              <li>Di bawah 45 → Lemah</li>
            </ul>
          </Step>

          <div className="border-border/60 border-t pt-3">
            <p className="text-foreground text-xs font-semibold">
              Yang belum tercakup
            </p>
            <ul className="text-muted-foreground mt-1 list-disc space-y-0.5 pl-4 text-[11px] leading-relaxed">
              <li>
                Komposisi audiens (berapa persen follower bot, demografi,
                lokasi) — tidak bisa didapat dari scrape profil publik. Deteksi
                di sini menyimpulkan dari pola engagement, bukan dari
                followernya langsung.
              </li>
              <li>
                Kualitas komentar — komentar &ldquo;🔥🔥&rdquo; dihitung sama
                dengan komentar bersubstansi.
              </li>
              <li>
                Biaya per engagement (CPE) — butuh input rate card influencer.
              </li>
              <li>
                Angka acuan tier adalah default yang masuk akal, belum
                dikalibrasi dengan data kampanye Anda sendiri.
              </li>
            </ul>
            <p className="text-muted-foreground mt-2 text-[11px] leading-relaxed">
              Tingkat keyakinan hasil ini:{" "}
              <strong className="text-foreground">{audit.confidence}</strong>.
              Itu menilai kecukupan data, bukan kualitas influencer-nya.
            </p>
          </div>
        </div>
      </CollapsiblePanel>
    </Collapsible>
  );
}
