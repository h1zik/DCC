"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { requireAdministrator } from "@/lib/auth-helpers";
import { replaceUserModeGrants, switchUserMode } from "@/lib/account-modes";
import { defaultHomeForRole } from "@/lib/role-home";

const grantsSchema = z.object({
  userId: z.string().min(1),
  customRoleIds: z.array(z.string().min(1)).max(20),
});

/**
 * Atur mode tambahan sebuah akun (CEO/Administrator saja). Tier CEO dan
 * Administrator ditolak sebagai mode tambahan.
 */
export async function setUserModeGrants(input: z.infer<typeof grantsSchema>) {
  const session = await requireAdministrator();
  const data = grantsSchema.parse(input);
  if (data.userId === session.user.id) {
    throw new Error("Anda tidak dapat mengubah mode akun Anda sendiri.");
  }
  await replaceUserModeGrants({
    userId: data.userId,
    customRoleIds: data.customRoleIds,
    grantedById: session.user.id,
  });
  revalidatePath("/admin/users");
}

const switchSchema = z.object({ customRoleId: z.string().min(1) });

/**
 * Pindahkan akun yang sedang login ke salah satu modenya. Client wajib
 * memanggil `update({ refreshRole: true })` sesudahnya agar JWT ikut berganti,
 * lalu memuat ulang ke `home`.
 */
export async function switchAccountMode(input: z.infer<typeof switchSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Belum masuk.");
  const { customRoleId } = switchSchema.parse(input);

  const next = await switchUserMode(session.user.id, customRoleId);
  revalidatePath("/", "layout");
  return { home: defaultHomeForRole(next.permissionTier), name: next.name };
}
