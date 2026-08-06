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
  feedPostCount: number;
  reelsPostCount: number;
  /** Permukaan yang jadi dasar angka utama: "feed" | "reels" | null. */
  primarySurface: string | null;
  feedEngagementRate: number | null;
  reelsEngagementRate: number | null;
  hiddenLikePosts: number;
  /** Jumlah komentar yang sempat dianalisis; 0 bila datanya tidak terbawa. */
  analyzedComments: number;
  brandSafetyHitCount: number;
};

/**
 * Ambang "komentar terlalu sedikit" per tier — disalin dari COMMENT_RATIO_FLOOR
 * di score.ts. Rasio komentar turun secara alami seiring besarnya akun, jadi
 * satu ambang untuk semua tier akan menuduh hampir setiap akun besar.
 */
const COMMENT_RATIO_FLOOR: Record<InfluencerTier, number> = {
  NANO: 0.4,
  MICRO: 0.4,
  MID: 0.4,
  MACRO: 0.3,
  MEGA: 0.2,
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
              Post yang dipin dibuang lebih dulu — Instagram menandainya, dan
              post pin sering berumur tahunan sehingga merusak baik ritme
              posting maupun rata-rata engagement. Kalau post terbaru kurang
              dari 6, semua post dipakai dan tingkat keyakinan diturunkan.
            </p>
          </Step>

          <Step n={2} title="Menilai feed dan Reels sebagai dua produk terpisah">
            <p>
              Di Instagram, grid profil dan tab Reels adalah{" "}
              <strong>dua koleksi terpisah</strong> dengan perilaku berbeda.
              Grid dikurasi pemilik akun dan hitungan view di sana tidak dapat
              dipercaya, jadi Reels diambil lewat panggilan terpisah.
            </p>
            <p>
              Keduanya dihitung <strong>penuh dan sendiri-sendiri</strong>{" "}
              dengan rumus ER yang sama persis, sehingga angkanya benar-benar
              sebanding. Angka utama lalu diambil dari{" "}
              <strong>permukaan terkuat</strong> — karena itulah format yang
              akan dipesan brand. Grid yang lemah tidak boleh menyeret turun
              akun yang Reels-nya kuat, dan sebaliknya.
            </p>
            <p>
              Audit ini memakai {audit.feedPostCount} post feed (ER{" "}
              {audit.feedEngagementRate !== null
                ? `${num(audit.feedEngagementRate, 2)}%`
                : "tidak terukur"}
              ) dan {audit.reelsPostCount} Reels (ER{" "}
              {audit.reelsEngagementRate !== null
                ? `${num(audit.reelsEngagementRate, 2)}%`
                : "tidak terukur"}
              ). Dasar skor:{" "}
              <strong>
                {audit.primarySurface === "reels"
                  ? "Reels"
                  : audit.primarySurface === "feed"
                    ? "post feed"
                    : "—"}
              </strong>
              . Jangkauan tetap dihitung hanya dari Reels.
            </p>
            <p>
              Sebuah permukaan baru boleh jadi dasar skor kalau punya minimal{" "}
              <strong>3 post terukur</strong>. Dua Reels bagus di antara dua
              puluh post feed lemah belum cukup untuk dijadikan janji.
            </p>
          </Step>

          <Step n={3} title="Menghitung engagement rate">
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
            <p>
              Post yang jumlah like-nya <strong>disembunyikan</strong> pemilik
              akun tidak dihitung sebagai nol — kalau tidak, akun yang sehat
              akan terlihat mati. Tapi juga tidak sekadar dibuang: jumlah
              komentarnya tetap publik, dan karena rasio komentar-terhadap-like
              sebuah akun cukup stabil antar post, like yang hilang{" "}
              <strong>diperkirakan dari komentar</strong>. Itu penting karena
              post yang disembunyikan sering justru yang paling lemah — menilai
              akun hanya dari post yang angkanya dibiarkan terlihat akan
              melebihkan hasilnya.
              {audit.hiddenLikePosts > 0 ? (
                <>
                  {" "}
                  Di audit ini ada <strong>{audit.hiddenLikePosts} post</strong>{" "}
                  seperti itu.
                </>
              ) : null}
            </p>
            <p>
              Karena perkiraan bisa meleset beberapa kali lipat, skornya ditahan:
              makin besar porsi post yang harus diperkirakan, makin rendah
              plafon nilai engagement-nya, dan di atas 30% vonis{" "}
              <strong>&ldquo;Sangat bagus&rdquo;</strong> tidak lagi diberikan.
              Untuk angka yang benar-benar pasti, minta screenshot Instagram
              Insights.
            </p>
          </Step>

          <Step n={4} title="Membandingkan dengan tier follower, bukan angka mutlak">
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

          <Step n={5} title="Memeriksa tanda engagement dibeli">
            <p>Ambang yang dipakai:</p>
            <ul className="list-disc space-y-0.5 pl-4">
              <li>
                Komentar di bawah{" "}
                <strong>
                  {num(COMMENT_RATIO_FLOOR[audit.tier ?? InfluencerTier.MICRO], 1)}%
                </strong>{" "}
                dari like → pola like berbayar. Ambangnya turun untuk tier
                besar (0,4% nano–mid, 0,3% macro, 0,2% mega) karena audiens akun
                besar memang jauh lebih pasif.
              </li>
              <li>Komentar di atas 20% dari like → engagement pod / bot</li>
              <li>
                <strong>Khusus TikTok:</strong> view di bawah 10% follower →
                follower tidak aktif
              </li>
              <li>
                Variasi engagement antar post di bawah 15% → terlalu seragam
                untuk akun organik
              </li>
              <li>Mengikuti lebih banyak dari pengikutnya → taktik follow/unfollow</li>
              <li>
                Komentar hampir seluruhnya tanpa substansi, berpola jualan, atau
                datang dari lingkaran akun yang sama
              </li>
            </ul>
            <p>
              Rasio komentar diambil sebagai <strong>nilai tengah antar post</strong>,
              bukan total komentar dibagi total like. Satu post giveaway dengan
              puluhan ribu komentar tidak lagi bisa menyeret rasionya dan
              memicu tuduhan yang keliru.
            </p>
            <p>
              Keseragaman engagement diperiksa <strong>per permukaan</strong>:
              kalau Reels seragam tapi feed bervariasi wajar, itu ciri format,
              bukan ciri paket engagement — jadi tidak diflag.
            </p>
            <p>
              Ambang view <strong>tidak</strong> dipakai untuk menilai keaslian
              akun Instagram. Di sana Reels didistribusikan lewat rekomendasi,
              bukan ke follower, jadi Reels yang sepi tidak berarti follower
              palsu — dilaporkan sebagai catatan jangkauan saja.
            </p>
            <p>
              Tiap temuan memotong skor keaslian (berat 30, sedang 18). Skor
              keaslian influencer ini{" "}
              <strong>{audit.authenticityScore}/100</strong>.
            </p>
          </Step>

          <Step n={6} title="Memisahkan post berbayar dari organik">
            <p>
              Terdeteksi <strong>{audit.sponsoredCount} post berbayar</strong>{" "}
              dan <strong>{audit.organicCount} organik</strong> di permukaan
              yang jadi dasar skor. Post endorse hampir selalu lebih rendah
              engagement-nya, dan angka itulah yang akan brand dapatkan — bukan
              rata-rata semua post.
            </p>
            <p>
              Perbandingannya sengaja dikurung di dalam satu permukaan: post
              berbayar berupa Reels tidak boleh diadu melawan post organik
              berupa carousel, karena yang terukur jadi selisih format, bukan
              selisih berbayar.
            </p>
          </Step>

          <Step n={7} title="Memindai risiko asosiasi merek">
            <p>
              Caption seluruh post yang diambil dipindai untuk judi online,
              pinjol, investasi bodong, klaim kesehatan berlebihan, konten
              dewasa, alkohol/vape, dan kampanye politik.{" "}
              {audit.brandSafetyHitCount > 0 ? (
                <strong>
                  {audit.brandSafetyHitCount} kategori terdeteksi.
                </strong>
              ) : (
                "Tidak ada yang terdeteksi."
              )}
            </p>
            <p>
              Temuan di sini <strong>tidak memotong skor</strong> — skor
              mengukur performa, ini soal risiko. Yang tingkat berat menahan
              vonis di &ldquo;perlu dicek&rdquo; sampai ada yang membuka
              post-nya, karena pencocokan kata tidak memahami konteks.
            </p>
          </Step>

          {components ? (
            <Step n={8} title="Menjumlahkan skor akhir">
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

          <Step n={components ? 9 : 8} title="Menentukan vonis">
            <ul className="list-disc space-y-0.5 pl-4">
              <li>
                <strong>Dua atau lebih</strong> sinyal keaslian berat, atau skor
                keaslian di bawah 50 → <strong>Mencurigakan</strong>
              </li>
              <li>
                <strong>Satu</strong> sinyal keaslian berat →{" "}
                <strong>Perlu dicek</strong> (skor dibatasi 60)
              </li>
              <li>Skor 80+ → Sangat bagus</li>
              <li>Skor 65–79 → Bagus</li>
              <li>Skor 45–64 → Rata-rata</li>
              <li>Di bawah 45 → Lemah</li>
            </ul>
            <p>
              Dua pengaman terakhir: vonis <strong>&ldquo;Sangat bagus&rdquo;</strong>{" "}
              tidak diberikan bila tingkat keyakinan rendah — empat post belum
              cukup untuk janji terbaik, dan angkanya masih bisa bergerak jauh.
              Risiko asosiasi tingkat berat juga menahan vonis di{" "}
              <strong>&ldquo;Perlu dicek&rdquo;</strong> sebagus apa pun
              angkanya.
            </p>
            <p>
              Tuduhan kecurangan butuh korroborasi. Tiap sinyal punya tingkat
              salah-tuduh sendiri, jadi satu sinyal berdiri sendiri hanya cukup
              untuk <em>menahan dan memeriksa</em> — bukan menyimpulkan. Dua
              sinyal yang saling menguatkan barulah kesimpulan.
            </p>
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
                Kualitas komentar hanya terbaca bila dataset ikut membawa
                contoh komentar
                {audit.analyzedComments > 0
                  ? ` (audit ini: ${audit.analyzedComments} komentar)`
                  : " — di audit ini tidak terbawa, jadi tidak dinilai"}
                . Yang terbaca pun komentar teratas, bukan seluruhnya.
              </li>
              <li>
                Risiko merek dipindai dari <em>caption</em> saja. Konten
                berisiko yang hanya muncul di dalam video atau gambar tidak
                terdeteksi, dan post yang justru mengkritik judi online bisa
                ikut tertangkap.
              </li>
              <li>
                Biaya per engagement (CPE) — butuh input rate card influencer.
              </li>
              <li>
                Angka acuan tier adalah default yang masuk akal, belum
                dikalibrasi dengan data kampanye Anda sendiri. Acuan yang sama
                dipakai untuk feed dan Reels, padahal keduanya bisa punya
                median industri yang berbeda.
              </li>
              <li>
                Feed dan Reels bisa mencakup rentang waktu yang tidak sama bila
                salah satunya jarang diposting, sehingga perbandingannya tidak
                selalu periode yang persis sama.
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
