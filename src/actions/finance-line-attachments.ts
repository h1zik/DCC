"use server";

import { randomUUID } from "node:crypto";
import { FinanceAuditAction } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireFinance } from "@/lib/auth-helpers";
import { logFinanceAudit } from "@/lib/finance-audit";
import { ensurePeriodOpen } from "@/lib/finance-period-lock";
import {
  FINANCE_ATTACHMENT_ALLOWED_MIME,
  FINANCE_ATTACHMENT_MAX_BYTES,
  removeFinanceAttachment,
  saveFinanceAttachment,
} from "@/lib/finance-uploads";
import { sniffMimeFromBytes } from "@/lib/file-signature";

function paths(entryId?: string) {
  revalidatePath("/finance/journals");
  if (entryId) revalidatePath(`/finance/journals/${entryId}`);
}

/**
 * Upload satu lampiran untuk satu baris jurnal.
 * Hanya boleh kalau jurnal masih DRAF dan periode belum dikunci.
 */
export async function uploadFinanceLineAttachment(formData: FormData) {
  const session = await requireFinance();
  const lineId = String(formData.get("lineId") ?? "");
  const file = formData.get("file");

  if (!lineId) throw new Error("lineId wajib.");
  if (!(file instanceof File)) throw new Error("File wajib di-upload.");
  if (file.size <= 0) throw new Error("File kosong.");
  if (file.size > FINANCE_ATTACHMENT_MAX_BYTES) {
    throw new Error("Ukuran file maksimum 10 MB.");
  }
  if (!FINANCE_ATTACHMENT_ALLOWED_MIME.has(file.type)) {
    throw new Error(
      `Tipe file ${file.type || "tidak dikenali"} tidak diizinkan. Gunakan JPG/PNG/WebP/HEIC/PDF.`,
    );
  }

  const line = await prisma.financeJournalLine.findUniqueOrThrow({
    where: { id: lineId },
    include: { entry: true },
  });

  // Bukti susulan boleh ditambahkan ke jurnal POSTED — termasuk di periode
  // terkunci — karena lampiran tidak mengubah angka pembukuan; dulu dilarang,
  // padahal hampir semua jalur cepat (AP/AR, payout, transfer) langsung POSTED
  // sehingga transaksi itu tidak akan pernah punya bukti. Penambahan pada
  // jurnal POSTED dicatat di jejak audit; penghapusan tetap hanya saat draf.
  const isPosted = line.entry.status === "POSTED";
  if (!isPosted) await ensurePeriodOpen(line.entry.entryDate);

  const attachmentId = randomUUID();
  const arrayBuffer = await file.arrayBuffer();
  const bytes = Buffer.from(arrayBuffer);

  // Tipe yang dipercaya adalah hasil sniff magic bytes — `file.type`
  // dikirim klien dan mudah dipalsukan (cek di atas hanya fast-feedback).
  const sniffedMime = sniffMimeFromBytes(bytes);
  if (!sniffedMime || !FINANCE_ATTACHMENT_ALLOWED_MIME.has(sniffedMime)) {
    throw new Error(
      "Isi file tidak dikenali sebagai JPG/PNG/WebP/HEIC/PDF yang valid.",
    );
  }

  const saved = await saveFinanceAttachment({
    entryId: line.entryId,
    attachmentId,
    fileName: file.name,
    bytes,
  });

  await prisma.$transaction(async (tx) => {
    await tx.financeJournalLineAttachment.create({
      data: {
        id: attachmentId,
        lineId: line.id,
        fileName: file.name,
        mimeType: sniffedMime,
        size: saved.size,
        url: saved.storagePath,
        hash: saved.hash,
        uploadedById: session.user.id,
      },
    });
    if (isPosted) {
      await logFinanceAudit(tx, {
        action: FinanceAuditAction.ATTACHMENT_ADD,
        actorId: session.user.id,
        entityId: line.entryId,
        detail: `Lampiran susulan pada ${line.entry.entryNumber ?? "jurnal terposting"}: ${file.name} (sha256 ${saved.hash.slice(0, 12)}…)`,
      });
    }
  });

  paths(line.entryId);
}

/**
 * Hapus lampiran. Hanya boleh kalau jurnal masih DRAF dan periode terbuka.
 * File fisik dihapus dulu; gagal hapus disk diabaikan (file mungkin sudah hilang).
 */
export async function deleteFinanceLineAttachment(attachmentId: string) {
  const session = await requireFinance();
  const att = await prisma.financeJournalLineAttachment.findUniqueOrThrow({
    where: { id: attachmentId },
    include: { line: { include: { entry: true } } },
  });

  if (att.line.entry.status !== "DRAFT") {
    throw new Error(
      "Jurnal sudah diposting. Lampiran tidak dapat dihapus.",
    );
  }
  await ensurePeriodOpen(att.line.entry.entryDate);

  await removeFinanceAttachment(att.url);
  await prisma.$transaction(async (tx) => {
    await tx.financeJournalLineAttachment.delete({ where: { id: att.id } });
    await logFinanceAudit(tx, {
      action: FinanceAuditAction.ATTACHMENT_DELETE,
      actorId: session.user.id,
      entityId: att.line.entryId,
      detail: `Hapus lampiran draf: ${att.fileName}`,
    });
  });

  paths(att.line.entryId);
}
