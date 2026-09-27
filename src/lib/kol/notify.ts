import "server-only";

import { NotificationType } from "@prisma/client";
import { KOL_APPROVE_CAPABILITY, toLabAccess } from "@/lib/capabilities";
import { getCapabilitiesForUsers } from "@/lib/lab-access";
import { notifyUser } from "@/lib/notify";
import { prisma } from "@/lib/prisma";

/** User yang memegang `lab.kol.approve` (efektif, termasuk override per-user). */
export async function listKolApproverIds(): Promise<string[]> {
  const users = await prisma.user.findMany({ select: { id: true } });
  const caps = await getCapabilitiesForUsers(users.map((u) => u.id));
  return [...caps.entries()]
    .filter(([, set]) => toLabAccess(set).shell && set.has(KOL_APPROVE_CAPABILITY))
    .map(([id]) => id);
}

/**
 * Kabari approver ada pengajuan baru. Pengaju sendiri dilewati — dia tidak
 * boleh memutus pengajuannya. Kegagalan notifikasi tidak menggagalkan aksi.
 */
export async function notifyKolApprovers(message: string, exceptUserId: string) {
  try {
    const ids = (await listKolApproverIds()).filter((id) => id !== exceptUserId);
    await Promise.all(
      ids.map((id) => notifyUser(id, message, NotificationType.KOL_APPROVAL_REQUEST)),
    );
  } catch (e) {
    console.error("[kol] notify approvers failed", e);
  }
}

export async function notifyKolRequester(userId: string | null, message: string) {
  if (!userId) return;
  try {
    await notifyUser(userId, message, NotificationType.KOL_APPROVAL_DECIDED);
  } catch (e) {
    console.error("[kol] notify requester failed", e);
  }
}
