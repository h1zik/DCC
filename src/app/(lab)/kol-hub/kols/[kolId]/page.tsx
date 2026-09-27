import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InfluencerVerdict } from "@prisma/client";
import { ArrowUpRight, ClipboardList, UserRound } from "lucide-react";
import { VerdictBadge } from "@/components/brand-hub/influencer-badges";
import { compactCount as compactNumber } from "@/lib/kol/format";
import {
  KolBadge,
  KolStatusBadge,
  PlatformMark,
  ScheduleStatusBadge,
} from "@/components/kol-hub/kol-badges";
import { LabDetailPage } from "@/components/lab/lab-module-page";
import { LabCard, LabEmptyState, lab } from "@/components/lab/lab-primitives";
import { canApproveKol, ensureKolHubPage } from "@/lib/kol/auth";
import { rupiah, rupiahShort } from "@/lib/kol/format";
import {
  KOL_CHANGE_TYPE_LABEL,
  PLACEMENT_LABEL,
  TIER_LABEL,
} from "@/lib/kol/labels";
import { getKolDetail } from "@/lib/kol/readers";
import { getAccountRates } from "@/lib/kol/rate-context";
import { RateHint } from "@/components/kol-hub/rate-hint";
import { formatWibDate, formatWibDateTime } from "@/lib/kol/time";
import { cn } from "@/lib/utils";
import { AccountAuditButton, KolDetailActions, PendingChangeBanner } from "./kol-detail-client";

export const metadata: Metadata = { title: "Profil KOL · KOL Hub" };

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-2 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{value || <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}

export default async function KolDetailPage({
  params,
}: {
  params: Promise<{ kolId: string }>;
}) {
  const { kolId } = await params;
  const { session, access } = await ensureKolHubPage();
  const approver = await canApproveKol();
  const k = await getKolDetail(kolId, { revealSensitive: approver });
  if (!k) notFound();
  const rates = await getAccountRates(k.accounts.map((a) => a.id));

  const address = [k.address.line, k.address.district, k.address.city, k.address.province, k.address.postalCode]
    .filter(Boolean)
    .join(", ");

  return (
    <LabDetailPage
      icon={UserRound}
      backHref="/kol-hub/kols"
      title={k.fullName}
      description={
        <span className="flex flex-wrap items-center gap-1.5">
          <KolStatusBadge status={k.status} />
          {k.categories.map((c) => (
            <KolBadge key={c.id} tone="neutral">
              {c.name}
            </KolBadge>
          ))}
        </span>
      }
      right={
        <KolDetailActions
          kolId={k.id}
          status={k.status}
          hasPending={k.pendingChange != null}
          hasSchedules={k.schedules.length > 0}
        />
      }
    >
      {k.pendingChange ? (
        <PendingChangeBanner
          requestId={k.pendingChange.id}
          label={KOL_CHANGE_TYPE_LABEL[k.pendingChange.type]}
          requestedBy={k.pendingChange.requestedBy}
          createdAt={k.pendingChange.createdAt}
          reason={k.pendingChange.reason}
          isMine={k.pendingChange.requestedById === session.user.id}
          canDecide={approver && k.pendingChange.requestedById !== session.user.id}
          isCreate={k.pendingChange.type === "CREATE"}
        />
      ) : null}
      {k.status === "BLACKLISTED" && k.blacklistReason ? (
        <p className={cn(lab.nestedPanel, "border-red-500/30 text-sm")}>
          <span className="font-semibold">Alasan blacklist:</span> {k.blacklistReason}
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          <section className={lab.section}>
            <h2 className={lab.sectionTitle}>Akun & keaslian</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {k.accounts.map((a) => (
                <LabCard key={a.id} className="flex flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <PlatformMark platform={a.platform} className="size-7 text-[11px]" />
                      <div className="min-w-0">
                        <a
                          href={a.profileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 truncate text-sm font-semibold hover:underline"
                        >
                          @{a.handle}
                          <ArrowUpRight className="size-3.5 shrink-0" aria-hidden />
                        </a>
                        <p className="text-muted-foreground text-xs">
                          {a.isPrimary ? "Akun utama" : "Akun tambahan"}
                          {a.tier ? ` · ${TIER_LABEL[a.tier] ?? a.tier}` : ""}
                        </p>
                      </div>
                    </div>
                    <VerdictBadge
                      verdict={(a.audit?.verdict as InfluencerVerdict | null) ?? null}
                    />
                  </div>
                  <dl className="grid grid-cols-3 gap-2">
                    {[
                      {
                        label: "Followers",
                        value: a.followers != null ? compactNumber(a.followers) : "—",
                      },
                      {
                        label: "Median views",
                        value: a.audit?.medianViews ? compactNumber(a.audit.medianViews) : "—",
                      },
                      {
                        label: "Rate card",
                        value: a.rateCard != null ? rupiahShort(a.rateCard) : "—",
                      },
                    ].map((m) => (
                      <div key={m.label} className={lab.nestedPanel + " p-2.5"}>
                        <dt className="text-muted-foreground text-[11px]">{m.label}</dt>
                        <dd className="text-sm font-semibold tabular-nums">{m.value}</dd>
                      </div>
                    ))}
                  </dl>
                  <RateHint
                    data={rates.get(a.id)}
                    rate={a.rateCard}
                  />
                  <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span>
                      {a.audit
                        ? `Audit ${formatWibDate(a.audit.auditedAt)} · skor keaslian ${a.audit.authenticityScore}/100`
                        : "Belum pernah diaudit"}
                    </span>
                    <span className="flex items-center gap-2">
                      {access.brandHub && a.influencerProfileId ? (
                        <Link
                          href={`/brand-hub/influencer-audit/${a.influencerProfileId}`}
                          className="font-medium text-[var(--lab-accent,var(--primary))] hover:underline"
                        >
                          Detail audit
                        </Link>
                      ) : null}
                      <AccountAuditButton accountId={a.id} hasAudit={a.audit != null} />
                    </span>
                  </div>
                </LabCard>
              ))}
            </div>
          </section>

          <section className={lab.section}>
            <div className="flex items-end justify-between gap-3">
              <h2 className={lab.sectionTitle}>Riwayat jadwal</h2>
              {k.status === "ACTIVE" ? (
                <Link
                  href={`/kol-hub/schedules/new?kol=${k.id}`}
                  className="text-xs font-medium text-[var(--lab-accent,var(--primary))] hover:underline"
                >
                  Buat jadwal untuk KOL ini
                </Link>
              ) : null}
            </div>
            {k.schedules.length === 0 ? (
              <LabEmptyState
                icon={ClipboardList}
                title="Belum pernah dijadwalkan"
                description={
                  k.status === "ACTIVE"
                    ? "Buat jadwal pertama untuk KOL ini."
                    : "KOL bisa dijadwalkan setelah disetujui approver."
                }
              />
            ) : (
              <LabCard className="overflow-x-auto p-0">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="text-muted-foreground border-b border-border/70 text-left text-[11px]">
                      <th className="px-4 py-2.5 font-medium">Jadwal</th>
                      <th className="px-3 py-2.5 font-medium">Campaign</th>
                      <th className="px-3 py-2.5 font-medium">Konten</th>
                      <th className="px-3 py-2.5 text-right font-medium">Biaya</th>
                      <th className="px-4 py-2.5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {k.schedules.map((s) => (
                      <tr key={s.id} className="hover:bg-muted/40">
                        <td className="px-4 py-2.5">
                          <Link href={`/kol-hub/schedules/${s.id}`} className="font-medium hover:underline">
                            {s.scheduledAt ? formatWibDateTime(s.scheduledAt) : "Tanggal belum diisi"}
                          </Link>
                          <p className="text-muted-foreground text-[11px]">{s.subNumber}</p>
                        </td>
                        <td className="px-3 py-2.5">
                          <p className="truncate">{s.campaignTitle}</p>
                          <p className="text-muted-foreground text-xs">{s.brandName}</p>
                        </td>
                        <td className="px-3 py-2.5 text-xs">
                          <span className="flex items-center gap-1.5">
                            <PlatformMark platform={s.platform} />
                            {PLACEMENT_LABEL[s.placement]} · {s.endorseType}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {rupiahShort(s.rate + s.additionalCost)}
                        </td>
                        <td className="px-4 py-2.5">
                          <ScheduleStatusBadge status={s.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </LabCard>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          <LabCard className="p-5">
            <h2 className={cn(lab.sectionTitle, "mb-2")}>Kerja sama</h2>
            <dl className="grid grid-cols-2 gap-2">
              <div className={lab.nestedPanel + " p-3"}>
                <dt className="text-muted-foreground text-[11px]">Jadwal aktif</dt>
                <dd className="text-lg font-bold tabular-nums">{k.stats.schedules}</dd>
              </div>
              <div className={lab.nestedPanel + " p-3"}>
                <dt className="text-muted-foreground text-[11px]">Sudah tayang</dt>
                <dd className="text-lg font-bold tabular-nums">{k.stats.posted}</dd>
              </div>
            </dl>
            <p className="text-muted-foreground mt-3 text-xs">
              Total biaya terkomitmen <span className="text-foreground font-semibold">{rupiah(k.stats.totalFee)}</span>
              {k.stats.brands.length ? ` untuk ${k.stats.brands.join(", ")}` : ""}.
            </p>
          </LabCard>

          <LabCard className="p-5">
            <h2 className={cn(lab.sectionTitle, "mb-1")}>Kontak & alamat</h2>
            <dl className="divide-y divide-border/50">
              <Row label="Email" value={k.email} />
              <Row label="HP / WA" value={k.phone} />
              <Row label="Tgl lahir" value={k.birthDate ? formatWibDate(k.birthDate) : null} />
              <Row label="Alamat" value={address} />
            </dl>
          </LabCard>

          <LabCard className="p-5">
            <h2 className={cn(lab.sectionTitle, "mb-1")}>Rekening</h2>
            <dl className="divide-y divide-border/50">
              <Row label="Bank" value={k.bank.name} />
              <Row label="Cabang" value={k.bank.branch} />
              <Row label="Atas nama" value={k.bank.holder} />
              <Row label="Nomor" value={k.bank.number} />
            </dl>
            {!k.sensitiveRevealed && (k.bank.number || k.phone) ? (
              <p className="text-muted-foreground mt-2 text-[11px]">
                Nomor lengkap hanya terlihat oleh approver KOL Hub.
              </p>
            ) : null}
          </LabCard>

          {k.notes ? (
            <LabCard className="p-5">
              <h2 className={cn(lab.sectionTitle, "mb-1")}>Catatan</h2>
              <p className="text-sm whitespace-pre-line">{k.notes}</p>
            </LabCard>
          ) : null}

          <LabCard className="p-5">
            <h2 className={cn(lab.sectionTitle, "mb-2")}>Jejak persetujuan</h2>
            <ul className="text-muted-foreground flex flex-col gap-2 text-xs">
              <li>
                Ditambahkan {formatWibDate(k.createdAt)}
                {k.createdBy ? ` oleh ${k.createdBy}` : ""}
              </li>
              {k.approvedAt ? (
                <li>
                  Disetujui {formatWibDate(k.approvedAt)}
                  {k.approvedBy ? ` oleh ${k.approvedBy}` : ""}
                </li>
              ) : null}
              {k.history.map((h) => (
                <li key={h.id}>
                  {KOL_CHANGE_TYPE_LABEL[h.type]} {h.status === "APPROVED" ? "disetujui" : "ditolak"}
                  {h.decidedAt ? ` ${formatWibDate(h.decidedAt)}` : ""}
                  {h.decidedBy ? ` oleh ${h.decidedBy}` : ""}
                  {h.decisionNote ? ` — ${h.decisionNote}` : ""}
                </li>
              ))}
            </ul>
          </LabCard>
        </aside>
      </div>
    </LabDetailPage>
  );
}
