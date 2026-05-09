"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireFinance } from "@/lib/auth-helpers";
import { ensurePeriodOpen } from "@/lib/finance-period-lock";
import {
  FINANCE_ATTACHMENT_ALLOWED_MIME,
  FINANCE_ATTACHMENT_MAX_BYTES,
  removeFinanceAttachment,
  saveFinanceAttachment,
} from "@/lib/finance-uploads";

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

  if (line.entry.status !== "DRAFT") {
    throw new Error(
      "Jurnal sudah diposting. Lampiran hanya bisa ditambah saat draf.",
    );
  }
  await ensurePeriodOpen(line.entry.entryDate);

  const attachmentId = randomUUID();
  const arrayBuffer = await file.arrayBuffer();
  const bytes = Buffer.from(arrayBuffer);

  const saved = await saveFinanceAttachment({
    entryId: line.entryId,
    attachmentId,
    fileName: file.name,
    bytes,
  });

  await prisma.financeJournalLineAttachment.create({
    data: {
      id: attachmentId,
      lineId: line.id,
      fileName: file.name,
      mimeType: file.type,
      size: saved.size,
      url: saved.storagePath,
      hash: saved.hash,
      uploadedById: session.user.id,
    },
  });

  paths(line.entryId);
}

/**
 * Hapus lampiran. Hanya boleh kalau jurnal masih DRAF dan periode terbuka.
 * File fisik dihapus dulu; gagal hapus disk diabaikan (file mungkin sudah hilang).
 */
export async function deleteFinanceLineAttachment(attachmentId: string) {
  await requireFinance();
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
  await prisma.financeJournalLineAttachment.delete({ where: { id: att.id } });

  paths(att.line.entryId);
}
