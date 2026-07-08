/**
 * Aturan boleh-equip (murni, di-pin test). Sumber kebenaran authz di server:
 * user hanya bisa memasang kosmetik yang benar-benar berhak dipakai.
 * - FREE / CUSTOM_UPLOAD: selalu boleh.
 * - LEVEL: butuh level ≥ unlockLevel.
 * - ACHIEVEMENT: butuh kepemilikan (UserCosmetic, di-grant saat unlock).
 * Selalu cek tipe item cocok dengan slot.
 */
export type EquipCandidate = {
  id: string;
  type: string;
  unlockType: string;
  unlockLevel: number | null;
};

export function canEquipCosmetic(
  item: EquipCandidate,
  opts: { slotType: string; level: number; ownedIds: Set<string> },
): { ok: boolean; reason?: string } {
  if (item.type !== opts.slotType) {
    return { ok: false, reason: "Tipe kosmetik tidak cocok dengan slot." };
  }
  switch (item.unlockType) {
    case "FREE":
    case "CUSTOM_UPLOAD":
      return { ok: true };
    case "LEVEL":
      // Level cukup ATAU sudah dimiliki (mis. grant manual) → boleh.
      return opts.level >= (item.unlockLevel ?? 1) || opts.ownedIds.has(item.id)
        ? { ok: true }
        : { ok: false, reason: `Item terbuka di Level ${item.unlockLevel ?? "?"}.` };
    case "ACHIEVEMENT":
    default:
      return opts.ownedIds.has(item.id)
        ? { ok: true }
        : { ok: false, reason: "Item kosmetik ini belum kamu miliki." };
  }
}

export const COSMETIC_SLOT_TYPE = {
  equippedBackgroundId: "PROFILE_BACKGROUND",
  equippedBorderId: "AVATAR_BORDER",
  equippedNameplateId: "NAMEPLATE",
  equippedTitleId: "TITLE",
} as const;
