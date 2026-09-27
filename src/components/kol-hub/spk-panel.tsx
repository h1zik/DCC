"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { FileDown, FileSignature, Send, Upload } from "lucide-react";
import { toast } from "sonner";
import { generateSpk, markSpkSent, uploadSignedSpk } from "@/actions/kol-spk";
import { KolBadge } from "@/components/kol-hub/kol-badges";
import { KolSelect } from "@/components/kol-hub/kol-fields";
import { LabCard, lab } from "@/components/lab/lab-primitives";
import { Button } from "@/components/ui/button";
import { actionErrorMessage } from "@/lib/action-error-message";
import { SPK_META, type KolSpkStatusValue } from "@/lib/kol/labels";
import { cn } from "@/lib/utils";

/** SPK satu jadwal: buat dari template → kirim → unggah salinan bertanda tangan. */
export function SpkPanel({
  scheduleId,
  scheduleStatus,
  canAccess,
  templates,
  doc,
}: {
  scheduleId: string;
  scheduleStatus: string;
  /** Approver, pengaju jadwal, atau PIC. */
  canAccess: boolean;
  templates: { id: string; name: string; isDefault: boolean; scope: string }[];
  doc: {
    id: string;
    docNumber: string;
    status: KolSpkStatusValue;
    hasSigned: boolean;
    templateId: string | null;
  } | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement | null>(null);
  // Template utama khusus brand lebih diutamakan daripada template organisasi.
  const preferred =
    templates.find((t) => t.isDefault && t.scope === "BRAND") ??
    templates.find((t) => t.isDefault) ??
    templates[0];
  const [templateId, setTemplateId] = useState(doc?.templateId ?? preferred?.id ?? "");
  const eligible = ["APPROVED", "SCHEDULED", "POSTED"].includes(scheduleStatus);

  const run = (fn: () => Promise<unknown>, ok: string) =>
    startTransition(async () => {
      try {
        await fn();
        toast.success(ok);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Aksi SPK gagal."));
      }
    });

  return (
    <LabCard className="flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className={cn(lab.sectionTitle, "flex items-center gap-2")}>
          <FileSignature className="size-4" aria-hidden />
          SPK
        </h2>
        {doc ? (
          <span className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground tabular-nums">{doc.docNumber}</span>
            <KolBadge tone={SPK_META[doc.status].tone}>{SPK_META[doc.status].label}</KolBadge>
          </span>
        ) : null}
      </div>

      {!eligible ? (
        <p className="text-muted-foreground text-sm">SPK bisa dibuat setelah jadwal disetujui.</p>
      ) : !canAccess ? (
        <p className="text-muted-foreground text-sm">
          SPK berisi data pribadi KOL — hanya approver, pengaju jadwal, atau PIC yang bisa membuat dan membukanya.
        </p>
      ) : templates.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Belum ada template SPK.{" "}
          <Link href="/kol-hub/settings/spk-templates" className="underline">
            Buat template
          </Link>
          .
        </p>
      ) : (
        <>
          {doc?.status !== "SIGNED" ? (
            <div className="flex flex-wrap items-center gap-2">
              <KolSelect
                className="w-[240px]"
                ariaLabel="Template SPK"
                value={templateId}
                onChange={setTemplateId}
                options={templates.map((t) => ({
                  value: t.id,
                  label: `${t.name}${t.isDefault ? " (utama)" : ""}`,
                }))}
              />
              <Button
                size="sm"
                variant={doc ? "outline" : "default"}
                disabled={pending || !templateId}
                onClick={() =>
                  run(
                    () => generateSpk(scheduleId, templateId),
                    doc ? "SPK dibuat ulang dengan data terbaru." : "SPK dibuat.",
                  )
                }
              >
                {doc ? "Buat ulang" : "Buat SPK"}
              </Button>
            </div>
          ) : null}

          {doc ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                render={<a href={`/api/kol/spk/${doc.id}/pdf`} target="_blank" rel="noreferrer" />}
              >
                <FileDown />
                Unduh PDF
              </Button>
              {doc.status === "GENERATED" ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => run(() => markSpkSent(doc.id), "SPK ditandai terkirim.")}
                >
                  <Send />
                  Tandai terkirim
                </Button>
              ) : null}
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  const fd = new FormData();
                  fd.set("docId", doc.id);
                  fd.set("file", file);
                  run(() => uploadSignedSpk(fd), "SPK bertanda tangan tersimpan.");
                }}
              />
              <Button size="sm" disabled={pending} onClick={() => fileRef.current?.click()}>
                <Upload />
                {doc.hasSigned ? "Ganti file bertanda tangan" : "Unggah SPK bertanda tangan"}
              </Button>
              {doc.hasSigned ? (
                <a
                  href={`/api/kol/spk/${doc.id}/signed`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-medium text-[var(--lab-accent,var(--primary))] hover:underline"
                >
                  Lihat salinan bertanda tangan
                </a>
              ) : null}
            </div>
          ) : null}
          <p className="text-muted-foreground text-[11px]">
            Isi SPK dibekukan saat dibuat. Setelah salinan bertanda tangan diunggah, jadwal yang masih
            &ldquo;Disetujui&rdquo; otomatis menjadi &ldquo;Siap tayang&rdquo;.
          </p>
        </>
      )}
    </LabCard>
  );
}
