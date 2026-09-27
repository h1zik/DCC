"use server";

import { KolScheduleStatus, KolSpkScope, KolSpkStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canApproveKol, requireKolUser } from "@/lib/kol/auth";
import { logKolAudit } from "@/lib/kol/audit";
import { buildSpkContext, nextSpkNumber } from "@/lib/kol/spk";
import {
  removeKolFileBestEffort,
  saveSignedSpk,
  SPK_SIGNED_ALLOWED_MIME,
  SPK_SIGNED_MAX_BYTES,
} from "@/lib/kol/spk-storage";
import { DEFAULT_SPK_TEMPLATE, fillSpkVariables } from "@/lib/kol/spk-template";
import { sniffMimeFromBytes } from "@/lib/file-signature";
import { prisma } from "@/lib/prisma";

const templateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  scope: z.enum(["ORGANIZATION", "BRAND"]),
  brandId: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  body: z.string().min(20, "Isi template terlalu pendek.").max(50_000),
  isDefault: z.boolean().default(false),
});

function revalidateSpk(scheduleId?: string) {
  revalidatePath("/kol-hub/settings/spk-templates");
  if (scheduleId) revalidatePath(`/kol-hub/schedules/${scheduleId}`);
  revalidatePath("/kol-hub/schedules");
}

export async function saveSpkTemplate(id: string | null, input: z.input<typeof templateSchema>) {
  const session = await requireKolUser();
  const data = templateSchema.parse(input);
  if (data.scope === "BRAND" && !data.brandId) throw new Error("Pilih brand untuk template khusus brand.");
  const fields = {
    name: data.name,
    scope: data.scope as KolSpkScope,
    brandId: data.scope === "BRAND" ? data.brandId : null,
    body: data.body,
    isDefault: data.isDefault,
  };
  const row = await prisma.$transaction(async (tx) => {
    if (data.isDefault) {
      // Satu default per cakupan (organisasi, atau per brand).
      await tx.kolSpkTemplate.updateMany({
        where: { scope: fields.scope, brandId: fields.brandId, ...(id ? { id: { not: id } } : {}) },
        data: { isDefault: false },
      });
    }
    return id
      ? tx.kolSpkTemplate.update({ where: { id }, data: fields })
      : tx.kolSpkTemplate.create({ data: { ...fields, createdById: session.user.id } });
  });
  await logKolAudit(prisma, {
    actorId: session.user.id,
    entityType: "settings",
    entityId: row.id,
    action: id ? "spk_template.update" : "spk_template.create",
  });
  revalidateSpk();
  return { id: row.id };
}

export async function archiveSpkTemplate(id: string) {
  const session = await requireKolUser();
  await prisma.kolSpkTemplate.update({
    where: { id },
    data: { archivedAt: new Date(), isDefault: false },
  });
  await logKolAudit(prisma, {
    actorId: session.user.id,
    entityType: "settings",
    entityId: id,
    action: "spk_template.archive",
  });
  revalidateSpk();
}

/** Buat template bawaan pertama bila belum ada satu pun. */
export async function createDefaultSpkTemplate() {
  const session = await requireKolUser();
  const count = await prisma.kolSpkTemplate.count();
  if (count > 0) throw new Error("Sudah ada template SPK.");
  const row = await prisma.kolSpkTemplate.create({
    data: {
      name: "SPK endorsement standar",
      scope: KolSpkScope.ORGANIZATION,
      body: DEFAULT_SPK_TEMPLATE,
      isDefault: true,
      createdById: session.user.id,
    },
  });
  revalidateSpk();
  return { id: row.id };
}

const SPK_ALLOWED: KolScheduleStatus[] = [
  KolScheduleStatus.APPROVED,
  KolScheduleStatus.SCHEDULED,
  KolScheduleStatus.POSTED,
];

/**
 * Buat (atau buat ulang) SPK dari template. Isi dibekukan saat ini juga.
 * Membuat ulang SPK yang sudah ditandatangani tidak diizinkan.
 */
export async function generateSpk(scheduleId: string, templateId: string) {
  const session = await requireKolUser();
  const [schedule, template, existing] = await Promise.all([
    prisma.kolSchedule.findUniqueOrThrow({
      where: { id: scheduleId },
      select: { status: true, brandId: true, requestedById: true, picUserId: true },
    }),
    prisma.kolSpkTemplate.findUniqueOrThrow({ where: { id: templateId } }),
    prisma.kolSpkDocument.findUnique({ where: { scheduleId } }),
  ]);
  const approver = await canApproveKol();
  if (!approver && schedule.requestedById !== session.user.id && schedule.picUserId !== session.user.id) {
    throw new Error("SPK hanya bisa dibuat approver, pengaju jadwal, atau PIC-nya.");
  }
  if (!SPK_ALLOWED.includes(schedule.status)) {
    throw new Error("SPK dibuat setelah jadwal disetujui.");
  }
  if (template.archivedAt) throw new Error("Template sudah diarsipkan.");
  if (template.scope === KolSpkScope.BRAND && template.brandId !== schedule.brandId) {
    throw new Error("Template itu khusus brand lain.");
  }
  if (existing?.status === KolSpkStatus.SIGNED) {
    throw new Error("SPK sudah ditandatangani — tidak bisa dibuat ulang.");
  }

  const doc = await prisma.$transaction(async (tx) => {
    const number = existing?.docNumber ?? (await nextSpkNumber(tx));
    const ctx = await buildSpkContext(scheduleId, number);
    const renderedBody = fillSpkVariables(template.body, ctx);
    return existing
      ? tx.kolSpkDocument.update({
          where: { id: existing.id },
          data: {
            templateId,
            renderedBody,
            status: KolSpkStatus.GENERATED,
            generatedById: session.user.id,
            generatedAt: new Date(),
            sentAt: null,
          },
        })
      : tx.kolSpkDocument.create({
          data: {
            scheduleId,
            templateId,
            docNumber: number,
            renderedBody,
            generatedById: session.user.id,
          },
        });
  });
  await logKolAudit(prisma, {
    actorId: session.user.id,
    entityType: "schedule",
    entityId: scheduleId,
    action: existing ? "spk.regenerated" : "spk.generated",
    meta: { docNumber: doc.docNumber },
  });
  revalidateSpk(scheduleId);
  return { id: doc.id, docNumber: doc.docNumber };
}

export async function markSpkSent(docId: string) {
  const session = await requireKolUser();
  const doc = await prisma.kolSpkDocument.findUniqueOrThrow({
    where: { id: docId },
    select: { scheduleId: true },
  });
  const updated = await prisma.kolSpkDocument.updateMany({
    where: { id: docId, status: KolSpkStatus.GENERATED },
    data: { status: KolSpkStatus.SENT, sentAt: new Date() },
  });
  if (updated.count === 0) throw new Error("SPK ini sudah dikirim atau ditandatangani.");
  await logKolAudit(prisma, {
    actorId: session.user.id,
    entityType: "schedule",
    entityId: doc.scheduleId,
    action: "spk.sent",
  });
  revalidateSpk(doc.scheduleId);
}

/**
 * Unggah SPK bertanda tangan (PDF/JPG/PNG ≤ 10 MB). Jadwal yang masih
 * "Disetujui" otomatis jadi "Siap tayang".
 */
export async function uploadSignedSpk(formData: FormData) {
  const session = await requireKolUser();
  const docId = z.string().min(1).parse(formData.get("docId"));
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("Pilih file SPK bertanda tangan.");
  if (file.size > SPK_SIGNED_MAX_BYTES) throw new Error("Ukuran file maksimal 10 MB.");

  const bytes = Buffer.from(await file.arrayBuffer());
  // Percaya isi file, bukan nama/ekstensinya.
  const sniffed = sniffMimeFromBytes(new Uint8Array(bytes));
  if (!sniffed || !SPK_SIGNED_ALLOWED_MIME.has(sniffed)) {
    throw new Error("File harus PDF, JPG, atau PNG.");
  }

  const doc = await prisma.kolSpkDocument.findUniqueOrThrow({
    where: { id: docId },
    select: { scheduleId: true, signedFileKey: true },
  });
  const key = await saveSignedSpk({ docId, fileName: file.name, bytes });

  await prisma.$transaction(async (tx) => {
    await tx.kolSpkDocument.update({
      where: { id: docId },
      data: {
        status: KolSpkStatus.SIGNED,
        signedAt: new Date(),
        signedFileKey: key,
        signedFileName: file.name.slice(0, 200),
        signedMime: sniffed,
        signedSize: bytes.byteLength,
      },
    });
    await tx.kolSchedule.updateMany({
      where: { id: doc.scheduleId, status: KolScheduleStatus.APPROVED },
      data: { status: KolScheduleStatus.SCHEDULED },
    });
    await logKolAudit(tx, {
      actorId: session.user.id,
      entityType: "schedule",
      entityId: doc.scheduleId,
      action: "spk.signed",
    });
  });
  // File lama (unggahan sebelumnya) tidak dipakai lagi.
  if (doc.signedFileKey && doc.signedFileKey !== key) await removeKolFileBestEffort(doc.signedFileKey);
  revalidateSpk(doc.scheduleId);
}
