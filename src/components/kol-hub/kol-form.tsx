"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createKolProfile, updateKolProfile } from "@/actions/kol-profiles";
import { Field, KolSelect, RupiahInput } from "@/components/kol-hub/kol-fields";
import { PlatformMark } from "@/components/kol-hub/kol-badges";
import { RateHint, type RateHintData } from "@/components/kol-hub/rate-hint";
import { LabCard, lab } from "@/components/lab/lab-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { actionErrorMessage } from "@/lib/action-error-message";
import { KOL_BANKS } from "@/lib/kol/banks";
import type { KolPlatformValue } from "@/lib/kol/labels";
import type { KolFormAccount, KolFormValues } from "@/lib/kol/form-defaults";
import { cn } from "@/lib/utils";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-4 border-t border-border/60 py-6 first:border-t-0 first:pt-0 md:grid-cols-[220px_minmax(0,1fr)] md:gap-8">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {description ? (
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{description}</p>
        ) : null}
      </div>
      <div className="grid gap-4">{children}</div>
    </section>
  );
}

export function KolForm({
  mode,
  kolId,
  initial,
  categories,
  status,
  masked,
  rateHints,
}: {
  mode: "create" | "edit";
  kolId?: string;
  initial: KolFormValues;
  categories: { id: string; name: string }[];
  /** Status profil saat edit — menentukan apakah perubahan butuh approval. */
  status?: string;
  /** Nilai tersamar untuk non-approver — kosongkan field = tetap pakai nilai lama. */
  masked?: { phone: string | null; accountNumber: string | null };
  /** Rekomendasi rate per id akun tersimpan (mode edit). */
  rateHints?: Record<string, RateHintData>;
}) {
  const router = useRouter();
  const [v, setV] = useState<KolFormValues>(initial);
  const [pending, startTransition] = useTransition();
  const needsApproval = mode === "edit" && (status === "ACTIVE" || status === "BLACKLISTED");

  const patch = (p: Partial<KolFormValues>) => setV((cur) => ({ ...cur, ...p }));
  const patchAccount = (i: number, p: Partial<KolFormAccount>) =>
    setV((cur) => ({
      ...cur,
      socialAccounts: cur.socialAccounts.map((a, j) => (j === i ? { ...a, ...p } : a)),
    }));

  function submit() {
    startTransition(async () => {
      try {
        const payload = {
          ...v,
          socialAccounts: v.socialAccounts.map((a) => ({
            id: a.id ?? null,
            platform: a.platform,
            handle: a.handle,
            rateCard: a.rateCard || null,
          })),
        };
        if (mode === "create") {
          const { id } = await createKolProfile(payload);
          toast.success("KOL ditambahkan dan diajukan ke approver.");
          router.push(`/kol-hub/kols/${id}`);
        } else if (kolId) {
          const res = await updateKolProfile(kolId, payload);
          toast.success(
            res.mode === "requested"
              ? "Perubahan diajukan — berlaku setelah disetujui approver."
              : res.resubmitted
                ? "Profil diperbarui dan diajukan ulang."
                : "Profil diperbarui.",
          );
          router.push(`/kol-hub/kols/${kolId}`);
        }
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menyimpan profil KOL."));
      }
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col gap-6"
    >
      {needsApproval ? (
        <p className={cn(lab.nestedPanel, "text-sm")}>
          KOL ini sudah aktif, jadi perubahan tidak langsung berlaku. Setelah disimpan,
          perubahan masuk antrean approval dan data lama tetap dipakai sampai disetujui.
        </p>
      ) : null}

      <LabCard className="p-5 sm:p-6">
        <Section
          title="Akun sosmed"
          description="Akun pertama jadi akun utama. Tempel username atau link profil. Rate card = harga yang diajukan KOL per konten."
        >
          <div className="flex flex-col gap-2">
            {v.socialAccounts.map((a, i) => (
              <div
                key={a.id ?? `new-${i}`}
                className="grid items-end gap-2 sm:grid-cols-[150px_minmax(0,1fr)_170px_auto]"
              >
                <Field label={i === 0 ? "Platform" : ""}>
                  <KolSelect
                    ariaLabel={`Platform akun ${i + 1}`}
                    value={a.platform}
                    onChange={(val) =>
                      patchAccount(i, { platform: (val || "INSTAGRAM") as KolPlatformValue })
                    }
                    options={[
                      {
                        value: "INSTAGRAM",
                        label: (
                          <span className="flex items-center gap-1.5">
                            <PlatformMark platform="INSTAGRAM" /> Instagram
                          </span>
                        ),
                      },
                      {
                        value: "TIKTOK",
                        label: (
                          <span className="flex items-center gap-1.5">
                            <PlatformMark platform="TIKTOK" /> TikTok
                          </span>
                        ),
                      },
                    ]}
                  />
                </Field>
                <Field label={i === 0 ? "Username atau link profil" : ""}>
                  <Input
                    aria-label={`Username akun ${i + 1}`}
                    placeholder={a.platform === "TIKTOK" ? "@username" : "username"}
                    value={a.handle}
                    onChange={(e) => patchAccount(i, { handle: e.target.value })}
                  />
                </Field>
                <Field label={i === 0 ? "Rate card" : ""}>
                  <RupiahInput
                    ariaLabel={`Rate card akun ${i + 1}`}
                    value={a.rateCard}
                    onChange={(raw) => patchAccount(i, { rateCard: raw })}
                  />
                </Field>
                <div className="flex h-8 items-center gap-1">
                  {i === 0 ? (
                    <span
                      className="text-muted-foreground flex size-8 items-center justify-center"
                      title="Akun utama"
                    >
                      <Star className="size-4 fill-current text-[var(--lab-accent,var(--primary))]" />
                    </span>
                  ) : (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        title="Jadikan akun utama"
                        aria-label="Jadikan akun utama"
                        onClick={() =>
                          setV((cur) => {
                            const list = [...cur.socialAccounts];
                            const [picked] = list.splice(i, 1);
                            return { ...cur, socialAccounts: [picked, ...list] };
                          })
                        }
                      >
                        <Star className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Hapus akun ${i + 1}`}
                        onClick={() =>
                          setV((cur) => ({
                            ...cur,
                            socialAccounts: cur.socialAccounts.filter((_, j) => j !== i),
                          }))
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </>
                  )}
                </div>
                {a.id && rateHints?.[a.id] ? (
                  <RateHint
                    className="sm:col-span-4"
                    data={rateHints[a.id]}
                    rate={Number(a.rateCard) || null}
                    onApply={(fair) => patchAccount(i, { rateCard: String(fair) })}
                  />
                ) : null}
              </div>
            ))}
            {v.socialAccounts.length < 8 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() =>
                  patch({
                    socialAccounts: [
                      ...v.socialAccounts,
                      {
                        platform: v.socialAccounts.some((a) => a.platform === "INSTAGRAM")
                          ? "TIKTOK"
                          : "INSTAGRAM",
                        handle: "",
                        rateCard: "",
                      },
                    ],
                  })
                }
              >
                <Plus />
                Tambah akun
              </Button>
            ) : null}
          </div>
        </Section>

        <Section title="Data diri" description="Dipakai untuk kontak & kontrak kerja sama.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nama lengkap" htmlFor="kol-name" className="sm:col-span-2">
              <Input
                id="kol-name"
                value={v.fullName}
                onChange={(e) => patch({ fullName: e.target.value })}
                required
              />
            </Field>
            <Field label="Email" htmlFor="kol-email" optional>
              <Input
                id="kol-email"
                type="email"
                value={v.email}
                onChange={(e) => patch({ email: e.target.value })}
              />
            </Field>
            <Field
              label="No. HP / WhatsApp"
              htmlFor="kol-phone"
              optional
              hint={masked?.phone ? "Kosongkan untuk tetap memakai nomor tersimpan." : undefined}
            >
              <Input
                id="kol-phone"
                inputMode="tel"
                placeholder={masked?.phone ?? undefined}
                value={v.phone}
                onChange={(e) => patch({ phone: e.target.value })}
              />
            </Field>
            <Field label="Tanggal lahir" htmlFor="kol-dob" optional>
              <Input
                id="kol-dob"
                type="date"
                value={v.birthDate}
                onChange={(e) => patch({ birthDate: e.target.value })}
              />
            </Field>
          </div>
          <Field
            label="Kategori"
            hint={
              categories.length === 0 ? (
                <>
                  Belum ada kategori.{" "}
                  <Link href="/kol-hub/settings/taxonomy" className="underline">
                    Buat kategori
                  </Link>
                  .
                </>
              ) : undefined
            }
          >
            <div className="flex flex-wrap gap-1.5">
              {categories.map((c) => {
                const on = v.categoryIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      patch({
                        categoryIds: on
                          ? v.categoryIds.filter((x) => x !== c.id)
                          : [...v.categoryIds, c.id],
                      })
                    }
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium ring-1 transition-colors",
                      on
                        ? "bg-[color-mix(in_srgb,var(--lab-accent,var(--primary))_14%,transparent)] text-[var(--lab-accent,var(--primary))] ring-[color-mix(in_srgb,var(--lab-accent,var(--primary))_35%,transparent)]"
                        : "text-muted-foreground ring-border hover:text-foreground",
                    )}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label="Catatan" htmlFor="kol-notes" optional>
            <Textarea
              id="kol-notes"
              rows={3}
              placeholder="Mis. gaya konten, preferensi brief, riwayat kerja sama"
              value={v.notes}
              onChange={(e) => patch({ notes: e.target.value })}
            />
          </Field>
        </Section>

        <Section title="Alamat kirim produk" description="Untuk pengiriman produk endorse.">
          <Field label="Alamat" htmlFor="kol-address" optional>
            <Textarea
              id="kol-address"
              rows={2}
              value={v.addressLine}
              onChange={(e) => patch({ addressLine: e.target.value })}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Kecamatan" htmlFor="kol-district" optional>
              <Input
                id="kol-district"
                value={v.district}
                onChange={(e) => patch({ district: e.target.value })}
              />
            </Field>
            <Field label="Kota / kabupaten" htmlFor="kol-city" optional>
              <Input id="kol-city" value={v.city} onChange={(e) => patch({ city: e.target.value })} />
            </Field>
            <Field label="Provinsi" htmlFor="kol-province" optional>
              <Input
                id="kol-province"
                value={v.province}
                onChange={(e) => patch({ province: e.target.value })}
              />
            </Field>
            <Field label="Kode pos" htmlFor="kol-postal" optional>
              <Input
                id="kol-postal"
                inputMode="numeric"
                value={v.postalCode}
                onChange={(e) => patch({ postalCode: e.target.value })}
              />
            </Field>
          </div>
        </Section>

        <Section
          title="Rekening pembayaran"
          description="Hanya approver yang bisa melihat nomor lengkapnya."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Bank / e-wallet" optional>
              <KolSelect
                ariaLabel="Bank"
                value={v.bankCode}
                onChange={(val) => patch({ bankCode: val })}
                emptyLabel="Belum diisi"
                options={KOL_BANKS.map((b) => ({ value: b.code, label: b.name }))}
              />
            </Field>
            <Field label="Cabang" htmlFor="kol-branch" optional>
              <Input
                id="kol-branch"
                value={v.bankBranch}
                onChange={(e) => patch({ bankBranch: e.target.value })}
              />
            </Field>
            <Field label="Nama pemilik rekening" htmlFor="kol-holder" optional>
              <Input
                id="kol-holder"
                value={v.accountHolder}
                onChange={(e) => patch({ accountHolder: e.target.value })}
              />
            </Field>
            <Field
              label="Nomor rekening"
              htmlFor="kol-accno"
              optional
              hint={
                masked?.accountNumber
                  ? "Kosongkan untuk tetap memakai nomor tersimpan."
                  : undefined
              }
            >
              <Input
                id="kol-accno"
                inputMode="numeric"
                placeholder={masked?.accountNumber ?? undefined}
                value={v.accountNumber}
                onChange={(e) => patch({ accountNumber: e.target.value })}
              />
            </Field>
          </div>
        </Section>
      </LabCard>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.back()}
          disabled={pending}
        >
          Batal
        </Button>
        <Button type="submit" disabled={pending}>
          {mode === "create"
            ? "Tambah & ajukan"
            : needsApproval
              ? "Ajukan perubahan"
              : "Simpan"}
        </Button>
      </div>
    </form>
  );
}
