import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Client Prisma biasa atau transaction client — agar cek kunci periode ikut transaksi pemanggil. */
type Db = typeof prisma | Prisma.TransactionClient;

/**
 * Mengembalikan kunci periode yang aktif untuk tanggal tertentu (atau null
 * jika periode bulan/tahun tersebut belum dikunci). Periode = (tahun, bulan).
 */
export async function findPeriodLockForDate(date: Date, db: Db = prisma) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return db.financePeriodLock.findUnique({
    where: { year_month: { year, month } },
    include: { lockedBy: { select: { name: true, email: true } } },
  });
}

/**
 * Lempar error dengan pesan yang jelas bila tanggal jurnal jatuh di periode
 * terkunci. Dipanggil dari semua aksi posting / pembalikan / hapus jurnal.
 * Beri `db` = transaction client bila dipanggil dari dalam transaksi supaya
 * pengecekan tidak berjalan di koneksi terpisah (race dengan penguncian).
 */
export async function ensurePeriodOpen(date: Date, db: Db = prisma) {
  const lock = await findPeriodLockForDate(date, db);
  if (!lock) return;
  const label = `${String(lock.month).padStart(2, "0")}-${lock.year}`;
  throw new Error(
    `Periode ${label} sudah dikunci (${lock.lockedBy?.name ?? lock.lockedBy?.email ?? "Finance"}). Buka kunci periode terlebih dahulu untuk memposting jurnal di tanggal ini.`,
  );
}

/** Daftar periode terkunci (terbaru di atas) untuk UI / panel "Tutup buku". */
export async function listPeriodLocks(limit = 24) {
  return prisma.financePeriodLock.findMany({
    take: Math.min(limit, 120),
    orderBy: [{ year: "desc" }, { month: "desc" }],
    include: { lockedBy: { select: { id: true, name: true, email: true } } },
  });
}

/** Cek tanpa throw — dipakai di UI client untuk menyembunyikan tombol. */
export async function isPeriodLocked(year: number, month: number): Promise<boolean> {
  const lock = await prisma.financePeriodLock.findUnique({
    where: { year_month: { year, month } },
    select: { id: true },
  });
  return Boolean(lock);
}
