"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Copy, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createScheduleOrder } from "@/actions/kol-schedules";
import { compactNumber } from "@/components/brand-hub/influencer-badges";
import { BudgetMeter } from "@/components/kol-hub/budget-meter";
import { PlatformMark } from "@/components/kol-hub/kol-badges";
import { RateHint, type RateHintData } from "@/components/kol-hub/rate-hint";
import { Field, KolSelect, RupiahInput } from "@/components/kol-hub/kol-fields";
import { LabCard, lab } from "@/components/lab/lab-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { actionErrorMessage } from "@/lib/action-error-message";
import { rupiah, rupiahShort } from "@/lib/kol/format";
import {
  OBJECTIVE_META,
  PLACEMENT_LABEL,
  PLACEMENTS_BY_PLATFORM,
  TIER_LABEL,
  type KolObjectiveValue,
  type KolPlacementValue,
} from "@/lib/kol/labels";
import type { SchedulableKol } from "@/lib/kol/readers";
import { cn } from "@/lib/utils";

type Slot = {
  key: number;
  socialAccountId: string;
  placement: KolPlacementValue | "";
  endorseTypeId: string;
  objective: KolObjectiveValue;
  scheduledAt: string;
  briefId: string;
  picUserId: string;
  productIds: string[];
  rate: string;
  additionalCost: string;
};

const RISKY_VERDICTS = new Set(["SUSPICIOUS", "NEEDS_REVIEW"]);

export function ScheduleBuilder({
  currentUserId,
  initialBrandId,
  initialCampaignId,
  initialKolId,
  brands,
  campaigns,
  budgets,
  kols,
  endorseTypes,
  briefs,
  products,
  users,
  rateHints,
}: {
  currentUserId: string;
  initialBrandId: string;
  initialCampaignId: string;
  initialKolId: string;
  brands: { id: string; name: string }[];
  campaigns: { id: string; title: string; brandId: string; budgetId: string }[];
  budgets: { id: string; name: string; beginning: number; committed: number; pending: number }[];
  kols: SchedulableKol[];
  endorseTypes: { id: string; name: string; isBarter: boolean }[];
  briefs: { id: string; title: string; brandId: string }[];
  products: { id: string; name: string; brandId: string; retailPrice: number | null }[];
  users: { id: string; name: string }[];
  /** Rekomendasi rate per id akun. */
  rateHints: Record<string, RateHintData>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [brandId, setBrandId] = useState(initialBrandId);
  const [campaignId, setCampaignId] = useState(initialCampaignId);
  const [kolId, setKolId] = useState(initialKolId);
  const [note, setNote] = useState("");
  const [nextKey, setNextKey] = useState(2);

  const kol = kols.find((k) => k.id === kolId) ?? null;
  const defaultType = endorseTypes.find((t) => !t.isBarter) ?? endorseTypes[0];

  const newSlot = (key: number, k: SchedulableKol | null): Slot => {
    const account = k?.accounts[0];
    return {
      key,
      socialAccountId: account?.id ?? "",
      placement: account ? PLACEMENTS_BY_PLATFORM[account.platform][0] : "",
      endorseTypeId: defaultType?.id ?? "",
      objective: "AWARENESS",
      scheduledAt: "",
      briefId: "",
      picUserId: currentUserId,
      productIds: [],
      rate: account?.rateCard != null ? String(account.rateCard) : "",
      additionalCost: "",
    };
  };

  const [slots, setSlots] = useState<Slot[]>(() => [newSlot(1, kol)]);

  const brandCampaigns = campaigns.filter((c) => c.brandId === brandId);
  const campaign = campaigns.find((c) => c.id === campaignId) ?? null;
  const budget = campaign ? budgets.find((b) => b.id === campaign.budgetId) ?? null : null;
  const brandBriefs = briefs.filter((b) => b.brandId === brandId);
  const brandProducts = products.filter((p) => p.brandId === brandId);
  const typeById = useMemo(() => new Map(endorseTypes.map((t) => [t.id, t])), [endorseTypes]);

  const slotTotal = (s: Slot) => {
    const barter = typeById.get(s.endorseTypeId)?.isBarter;
    return (barter ? 0 : Number(s.rate || 0)) + Number(s.additionalCost || 0);
  };
  const grandTotal = slots.reduce((a, s) => a + slotTotal(s), 0);
  const remainingAfter = budget ? budget.beginning - budget.committed - grandTotal : null;
  const overBudget = remainingAfter != null && remainingAfter < 0;

  const riskyAccounts = kol?.accounts.filter(
    (a) => a.audit?.verdict && RISKY_VERDICTS.has(a.audit.verdict),
  );

  const patchSlot = (key: number, p: Partial<Slot>) =>
    setSlots((cur) => cur.map((s) => (s.key === key ? { ...s, ...p } : s)));

  function chooseKol(id: string) {
    setKolId(id);
    const k = kols.find((x) => x.id === id) ?? null;
    // Akun lama milik KOL lain — set ulang tiap slot ke akun utama KOL baru.
    setSlots((cur) =>
      cur.map((s) => {
        const fresh = newSlot(s.key, k);
        return { ...s, socialAccountId: fresh.socialAccountId, placement: fresh.placement, rate: fresh.rate };
      }),
    );
  }

  function chooseBrand(id: string) {
    setBrandId(id);
    if (campaign && campaign.brandId !== id) setCampaignId("");
    setSlots((cur) => cur.map((s) => ({ ...s, briefId: "", productIds: [] })));
  }

  function chooseAccount(slot: Slot, accountId: string) {
    const account = kol?.accounts.find((a) => a.id === accountId);
    if (!account) return;
    const allowed = PLACEMENTS_BY_PLATFORM[account.platform];
    patchSlot(slot.key, {
      socialAccountId: accountId,
      placement: slot.placement && allowed.includes(slot.placement) ? slot.placement : allowed[0],
      rate: account.rateCard != null ? String(account.rateCard) : slot.rate,
    });
  }

  function submit(submitNow: boolean) {
    if (!brandId || !campaignId || !kolId) {
      toast.error("Pilih brand, campaign, dan KOL dulu.");
      return;
    }
    const incomplete = slots.findIndex((s) => !s.socialAccountId || !s.placement || !s.endorseTypeId);
    if (incomplete >= 0) {
      toast.error(`Slot ${incomplete + 1} belum lengkap.`);
      return;
    }
    startTransition(async () => {
      try {
        const res = await createScheduleOrder({
          brandId,
          campaignId,
          kolId,
          note,
          submit: submitNow,
          slots: slots.map((s) => ({
            socialAccountId: s.socialAccountId,
            placement: s.placement as KolPlacementValue,
            endorseTypeId: s.endorseTypeId,
            objective: s.objective,
            scheduledAt: s.scheduledAt || null,
            briefId: s.briefId || null,
            picUserId: s.picUserId || null,
            productIds: s.productIds,
            rate: typeById.get(s.endorseTypeId)?.isBarter ? "0" : s.rate || "0",
            additionalCost: s.additionalCost || null,
          })),
        });
        toast.success(
          submitNow
            ? `${res.orderNumber}: ${res.scheduleIds.length} jadwal diajukan ke approver.`
            : `${res.orderNumber} disimpan sebagai draf.`,
        );
        router.push(
          res.scheduleIds.length === 1
            ? `/kol-hub/schedules/${res.scheduleIds[0]}`
            : `/kol-hub/schedules?q=${encodeURIComponent(res.orderNumber)}`,
        );
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal membuat jadwal."));
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-5">
        <LabCard className="grid gap-4 p-5 sm:grid-cols-3">
          <Field label="Brand">
            <KolSelect
              ariaLabel="Brand"
              value={brandId}
              onChange={chooseBrand}
              options={brands.map((b) => ({ value: b.id, label: b.name }))}
            />
          </Field>
          <Field
            label="Campaign"
            hint={
              brandId && brandCampaigns.length === 0 ? (
                <>
                  Brand ini belum punya campaign.{" "}
                  <Link href="/kol-hub/campaigns" className="underline">
                    Buat campaign
                  </Link>
                </>
              ) : undefined
            }
          >
            <KolSelect
              ariaLabel="Campaign"
              value={campaignId}
              disabled={!brandId}
              placeholder={brandId ? "Pilih campaign" : "Pilih brand dulu"}
              onChange={setCampaignId}
              options={brandCampaigns.map((c) => ({ value: c.id, label: c.title }))}
            />
          </Field>
          <Field
            label="KOL"
            hint={
              kols.length === 0 ? (
                <>
                  Belum ada KOL aktif.{" "}
                  <Link href="/kol-hub/kols/new" className="underline">
                    Tambah KOL
                  </Link>
                </>
              ) : (
                "Hanya KOL yang sudah disetujui."
              )
            }
          >
            <KolSelect
              ariaLabel="KOL"
              value={kolId}
              onChange={chooseKol}
              placeholder="Pilih KOL"
              options={kols.map((k) => ({ value: k.id, label: k.fullName }))}
            />
          </Field>
          {riskyAccounts && riskyAccounts.length ? (
            <p className="flex items-start gap-2 rounded-xl bg-violet-500/10 p-3 text-xs text-violet-800 sm:col-span-3 dark:text-violet-200">
              <ShieldAlert className="mt-px size-4 shrink-0" aria-hidden />
              Audit terakhir menandai {riskyAccounts.map((a) => `@${a.handle}`).join(", ")} perlu
              dicek keasliannya. Pertimbangkan ulang sebelum mengajukan.
            </p>
          ) : null}
        </LabCard>

        <ol className="flex flex-col gap-4" aria-label="Slot konten">
          {slots.map((s, i) => {
            const account = kol?.accounts.find((a) => a.id === s.socialAccountId);
            const barter = typeById.get(s.endorseTypeId)?.isBarter ?? false;
            const placements = account ? PLACEMENTS_BY_PLATFORM[account.platform] : [];
            return (
              <li
                key={s.key}
                className={cn(
                  lab.card,
                  "grid overflow-visible sm:grid-cols-[76px_minmax(0,1fr)]",
                )}
              >
                {/* Sobekan tiket: nomor slot = urutan sub-order. */}
                <div className="flex items-center justify-between gap-3 border-b border-dashed border-border px-4 py-3 sm:flex-col sm:justify-start sm:border-r sm:border-b-0 sm:px-2 sm:py-5">
                  <div className="text-center">
                    <p className="text-muted-foreground text-[10px]">Slot</p>
                    <p className="text-3xl leading-none font-bold tabular-nums text-[var(--lab-accent,var(--primary))]">
                      {String(i + 1).padStart(2, "0")}
                    </p>
                  </div>
                  <p className="text-xs font-semibold tabular-nums sm:mt-3 sm:text-center">
                    {rupiahShort(slotTotal(s))}
                  </p>
                  <div className="flex gap-1 sm:mt-auto sm:flex-col">
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      title="Duplikat slot"
                      aria-label={`Duplikat slot ${i + 1}`}
                      onClick={() => {
                        setSlots((cur) => {
                          const idx = cur.findIndex((x) => x.key === s.key);
                          const copy = { ...s, key: nextKey };
                          return [...cur.slice(0, idx + 1), copy, ...cur.slice(idx + 1)];
                        });
                        setNextKey((k) => k + 1);
                      }}
                      disabled={slots.length >= 20}
                    >
                      <Copy />
                    </Button>
                    {slots.length > 1 ? (
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        title="Hapus slot"
                        aria-label={`Hapus slot ${i + 1}`}
                        onClick={() => setSlots((cur) => cur.filter((x) => x.key !== s.key))}
                      >
                        <Trash2 />
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-4 p-4 sm:p-5">
                  <div className="grid gap-4 md:grid-cols-3">
                    <Field label="Akun">
                      <KolSelect
                        ariaLabel={`Akun slot ${i + 1}`}
                        value={s.socialAccountId}
                        disabled={!kol}
                        placeholder={kol ? "Pilih akun" : "Pilih KOL dulu"}
                        onChange={(v) => chooseAccount(s, v)}
                        options={(kol?.accounts ?? []).map((a) => ({
                          value: a.id,
                          label: (
                            <span className="flex items-center gap-1.5">
                              <PlatformMark platform={a.platform} />@{a.handle}
                              {a.followers != null ? (
                                <span className="text-muted-foreground text-xs">
                                  {compactNumber(a.followers)}
                                  {a.tier ? ` · ${TIER_LABEL[a.tier] ?? a.tier}` : ""}
                                </span>
                              ) : null}
                            </span>
                          ),
                        }))}
                      />
                    </Field>
                    <Field label="Placement">
                      <KolSelect
                        ariaLabel={`Placement slot ${i + 1}`}
                        value={s.placement}
                        disabled={!account}
                        onChange={(v) => patchSlot(s.key, { placement: v as KolPlacementValue })}
                        options={placements.map((p) => ({ value: p, label: PLACEMENT_LABEL[p] }))}
                      />
                    </Field>
                    <Field label="Jenis endorse">
                      <KolSelect
                        ariaLabel={`Jenis endorse slot ${i + 1}`}
                        value={s.endorseTypeId}
                        onChange={(v) => patchSlot(s.key, { endorseTypeId: v })}
                        options={endorseTypes.map((t) => ({
                          value: t.id,
                          label: t.isBarter ? `${t.name} (tanpa fee)` : t.name,
                        }))}
                      />
                    </Field>
                  </div>

                  <fieldset className="grid gap-1.5">
                    <legend className="mb-1.5 text-xs font-medium">Tujuan konten</legend>
                    <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted/50 p-1">
                      {(Object.keys(OBJECTIVE_META) as KolObjectiveValue[]).map((o) => (
                        <button
                          key={o}
                          type="button"
                          aria-pressed={s.objective === o}
                          title={OBJECTIVE_META[o].hint}
                          onClick={() => patchSlot(s.key, { objective: o })}
                          className={cn(
                            "rounded-lg px-2 py-1.5 text-xs font-medium transition-colors",
                            s.objective === o
                              ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {OBJECTIVE_META[o].label}
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  <div className="grid gap-4 md:grid-cols-3">
                    <Field label="Tanggal & jam tayang (WIB)" htmlFor={`at-${s.key}`} optional>
                      <Input
                        id={`at-${s.key}`}
                        type="datetime-local"
                        value={s.scheduledAt}
                        onChange={(e) => patchSlot(s.key, { scheduledAt: e.target.value })}
                      />
                    </Field>
                    <Field label="Brief" optional>
                      <KolSelect
                        ariaLabel={`Brief slot ${i + 1}`}
                        value={s.briefId}
                        disabled={!brandId}
                        onChange={(v) => patchSlot(s.key, { briefId: v })}
                        emptyLabel="Tanpa brief"
                        options={brandBriefs.map((b) => ({ value: b.id, label: b.title }))}
                      />
                    </Field>
                    <Field label="PIC">
                      <KolSelect
                        ariaLabel={`PIC slot ${i + 1}`}
                        value={s.picUserId}
                        onChange={(v) => patchSlot(s.key, { picUserId: v })}
                        emptyLabel="Tanpa PIC"
                        options={users.map((u) => ({ value: u.id, label: u.name }))}
                      />
                    </Field>
                  </div>

                  <Field
                    label="Produk yang di-endorse"
                    optional
                    hint={
                      brandId && brandProducts.length === 0
                        ? "Brand ini belum punya produk di master Products."
                        : undefined
                    }
                  >
                    <div className="flex flex-wrap gap-1.5">
                      {brandProducts.map((p) => {
                        const on = s.productIds.includes(p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            aria-pressed={on}
                            onClick={() =>
                              patchSlot(s.key, {
                                productIds: on
                                  ? s.productIds.filter((x) => x !== p.id)
                                  : [...s.productIds, p.id],
                              })
                            }
                            className={cn(
                              "rounded-full px-3 py-1 text-xs font-medium ring-1 transition-colors",
                              on
                                ? "bg-[color-mix(in_srgb,var(--lab-accent,var(--primary))_14%,transparent)] text-[var(--lab-accent,var(--primary))] ring-[color-mix(in_srgb,var(--lab-accent,var(--primary))_35%,transparent)]"
                                : "text-muted-foreground ring-border hover:text-foreground",
                            )}
                          >
                            {p.name}
                          </button>
                        );
                      })}
                      {!brandId ? (
                        <span className="text-muted-foreground text-xs">Pilih brand dulu.</span>
                      ) : null}
                    </div>
                  </Field>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label="Rate KOL"
                      hint={
                        barter
                          ? "Barter — tidak ada fee."
                          : account?.rateCard != null
                            ? `Rate card akun ini ${rupiah(account.rateCard)}.`
                            : undefined
                      }
                    >
                      <RupiahInput
                        ariaLabel={`Rate slot ${i + 1}`}
                        value={barter ? "0" : s.rate}
                        disabled={barter}
                        onChange={(v) => patchSlot(s.key, { rate: v })}
                      />
                      {!barter && account ? (
                        <RateHint
                          data={rateHints[account.id]}
                          rate={Number(s.rate) || null}
                          onApply={(fair) => patchSlot(s.key, { rate: String(fair) })}
                        />
                      ) : null}
                    </Field>
                    <Field label="Biaya tambahan" optional hint="Mis. produksi, transport.">
                      <RupiahInput
                        ariaLabel={`Biaya tambahan slot ${i + 1}`}
                        value={s.additionalCost}
                        onChange={(v) => patchSlot(s.key, { additionalCost: v })}
                      />
                    </Field>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        <Button
          type="button"
          variant="outline"
          className="self-start"
          disabled={slots.length >= 20}
          onClick={() => {
            setSlots((cur) => [...cur, newSlot(nextKey, kol)]);
            setNextKey((k) => k + 1);
          }}
        >
          <Plus />
          Tambah slot
        </Button>

        <Field label="Catatan untuk approver & tim" htmlFor="order-note" optional>
          <Textarea
            id="order-note"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Mis. KOL minta DP 50%, draft konten H-3"
          />
        </Field>
      </div>

      {/* Rail budget — menempel, berkurang langsung saat slot berubah. */}
      <aside className="lg:sticky lg:top-[4.5rem] lg:self-start">
        <LabCard className="flex flex-col gap-4 p-5">
          <div>
            <p className="text-muted-foreground text-xs">
              {slots.length} slot · total
            </p>
            <p className="text-2xl font-bold tabular-nums">{rupiah(grandTotal)}</p>
          </div>
          {budget ? (
            <div className="flex flex-col gap-2">
              <p className="text-muted-foreground text-xs">Budget: {budget.name}</p>
              <BudgetMeter
                beginning={budget.beginning}
                committed={budget.committed}
                pending={budget.pending}
                planned={grandTotal}
              />
              {overBudget ? (
                <p className="text-xs font-medium text-red-600 dark:text-red-400">
                  Total melebihi sisa budget — kurangi slot atau minta approver menambah budget.
                  Draf tetap bisa disimpan.
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-muted-foreground text-xs">
              Pilih campaign untuk melihat sisa budget.
            </p>
          )}
          <ul className="text-muted-foreground flex flex-col gap-1 border-t border-border/60 pt-3 text-xs tabular-nums">
            {slots.map((s, i) => {
              const a = kol?.accounts.find((x) => x.id === s.socialAccountId);
              return (
                <li key={s.key} className="flex justify-between gap-2">
                  <span className="truncate">
                    {String(i + 1).padStart(2, "0")} · {a ? `@${a.handle}` : "—"}
                    {s.placement ? ` · ${PLACEMENT_LABEL[s.placement]}` : ""}
                  </span>
                  <span>{rupiahShort(slotTotal(s))}</span>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-col gap-2">
            <Button disabled={pending || overBudget} onClick={() => submit(true)}>
              Ajukan {slots.length} jadwal
            </Button>
            <Button variant="outline" disabled={pending} onClick={() => submit(false)}>
              Simpan sebagai draf
            </Button>
          </div>
          <p className="text-muted-foreground text-[11px] leading-relaxed">
            Jadwal yang diajukan langsung memakai budget sampai diputus approver. Ditolak atau
            dibatalkan, budget-nya kembali.
          </p>
        </LabCard>
      </aside>
    </div>
  );
}
