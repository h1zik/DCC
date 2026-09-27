import "server-only";

import { InfluencerPlatform, Prisma } from "@prisma/client";
import { parseInfluencerUrl } from "@/lib/apify/influencer-actors";
import { findKolBank } from "@/lib/kol/banks";
import type { KolProfileData } from "@/lib/kol/validation";
import { toDecimal } from "@/lib/finance-money";

export type NormalizedAccount = {
  id: string | null;
  platform: InfluencerPlatform;
  handle: string;
  profileUrl: string;
  rateCard: Prisma.Decimal | null;
};

/** Normalisasi username/link jadi handle kanonik + tolak duplikat di form. */
export function normalizeAccounts(data: KolProfileData): NormalizedAccount[] {
  const seen = new Set<string>();
  return data.socialAccounts.map((a) => {
    const parsed = parseInfluencerUrl(a.handle, a.platform as InfluencerPlatform);
    if (parsed.platform !== a.platform) {
      throw new Error(
        `Link @${parsed.handle} adalah akun ${parsed.platform === "TIKTOK" ? "TikTok" : "Instagram"}, bukan ${a.platform === "TIKTOK" ? "TikTok" : "Instagram"}.`,
      );
    }
    const key = `${parsed.platform}:${parsed.handle}`;
    if (seen.has(key)) {
      throw new Error(`Akun @${parsed.handle} ditulis dua kali.`);
    }
    seen.add(key);
    return {
      id: a.id ?? null,
      platform: parsed.platform,
      handle: parsed.handle,
      profileUrl: parsed.profileUrl,
      rateCard: a.rateCard ? toDecimal(a.rateCard) : null,
    };
  });
}

/**
 * Pastikan tidak ada akun yang sudah dipegang KOL lain. Pesan menyebut nama
 * pemiliknya supaya user tahu harus mengedit profil yang mana.
 */
export async function assertAccountsAvailable(
  tx: Prisma.TransactionClient,
  accounts: NormalizedAccount[],
  kolId: string | null,
) {
  if (accounts.length === 0) return;
  const clash = await tx.kolSocialAccount.findFirst({
    where: {
      OR: accounts.map((a) => ({ platform: a.platform, handle: a.handle })),
      ...(kolId ? { kolId: { not: kolId } } : {}),
    },
    select: { handle: true, kol: { select: { fullName: true } } },
  });
  if (clash) {
    throw new Error(
      `Akun @${clash.handle} sudah terdaftar atas nama ${clash.kol.fullName}.`,
    );
  }
}

function profileFields(data: KolProfileData) {
  const bank = findKolBank(data.bankCode);
  return {
    fullName: data.fullName,
    email: data.email,
    phone: data.phone,
    birthDate: data.birthDate ? new Date(`${data.birthDate}T00:00:00Z`) : null,
    notes: data.notes,
    addressLine: data.addressLine,
    district: data.district,
    city: data.city,
    province: data.province,
    postalCode: data.postalCode,
    bankCode: bank?.code ?? null,
    bankName: bank?.name ?? null,
    bankBranch: data.bankBranch,
    accountHolder: data.accountHolder,
    accountNumber: data.accountNumber,
  };
}

/** Find-or-create `InfluencerProfile` global untuk akun ini (tanpa scraping). */
async function linkInfluencerProfile(
  tx: Prisma.TransactionClient,
  a: NormalizedAccount,
  actorId: string,
) {
  const ip = await tx.influencerProfile.upsert({
    where: { platform_handle: { platform: a.platform, handle: a.handle } },
    create: {
      platform: a.platform,
      handle: a.handle,
      profileUrl: a.profileUrl,
      createdById: actorId,
    },
    update: {},
    select: { id: true },
  });
  return ip.id;
}

/**
 * Tulis data profil ke baris KOL: field, kategori, dan akun sosmed (update
 * yang ada, tambah yang baru, hapus yang dibuang). Akun yang sudah dipakai
 * jadwal tidak boleh dihapus.
 */
export async function applyKolProfileData(
  tx: Prisma.TransactionClient,
  kolId: string,
  data: KolProfileData,
  actorId: string,
) {
  const accounts = normalizeAccounts(data);
  await assertAccountsAvailable(tx, accounts, kolId);

  await tx.kolProfile.update({ where: { id: kolId }, data: profileFields(data) });

  await tx.kolProfileCategory.deleteMany({ where: { kolId } });
  if (data.categoryIds.length) {
    await tx.kolProfileCategory.createMany({
      data: [...new Set(data.categoryIds)].map((categoryId) => ({ kolId, categoryId })),
    });
  }

  const existing = await tx.kolSocialAccount.findMany({
    where: { kolId },
    select: { id: true, platform: true, handle: true, _count: { select: { schedules: true } } },
  });
  const byKey = new Map(existing.map((e) => [`${e.platform}:${e.handle}`, e]));
  const keep = new Set<string>();

  for (const [i, a] of accounts.entries()) {
    const match =
      (a.id ? existing.find((e) => e.id === a.id) : undefined) ??
      byKey.get(`${a.platform}:${a.handle}`);
    const influencerProfileId = await linkInfluencerProfile(tx, a, actorId);
    const fields = {
      platform: a.platform,
      handle: a.handle,
      profileUrl: a.profileUrl,
      rateCard: a.rateCard,
      isPrimary: i === 0,
      influencerProfileId,
    };
    if (match) {
      if (
        match._count.schedules > 0 &&
        (match.platform !== a.platform || match.handle !== a.handle)
      ) {
        throw new Error(
          `Akun @${match.handle} sudah dipakai jadwal — tambahkan akun baru alih-alih mengganti username-nya.`,
        );
      }
      await tx.kolSocialAccount.update({ where: { id: match.id }, data: fields });
      keep.add(match.id);
    } else {
      const created = await tx.kolSocialAccount.create({
        data: { kolId, ...fields },
        select: { id: true },
      });
      keep.add(created.id);
    }
  }

  const removed = existing.filter((e) => !keep.has(e.id));
  const blocked = removed.find((e) => e._count.schedules > 0);
  if (blocked) {
    throw new Error(
      `Akun @${blocked.handle} tidak bisa dihapus karena sudah dipakai jadwal.`,
    );
  }
  if (removed.length) {
    await tx.kolSocialAccount.deleteMany({
      where: { id: { in: removed.map((r) => r.id) } },
    });
  }
}

/** Buat baris KOL baru (status awal WAITING_APPROVAL) lalu isi datanya. */
export async function createKolProfileRow(
  tx: Prisma.TransactionClient,
  data: KolProfileData,
  actorId: string,
) {
  const accounts = normalizeAccounts(data);
  await assertAccountsAvailable(tx, accounts, null);
  const kol = await tx.kolProfile.create({
    data: { ...profileFields(data), createdById: actorId },
    select: { id: true },
  });
  await applyKolProfileData(tx, kol.id, data, actorId);
  return kol.id;
}
