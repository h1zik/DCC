import { UserRole } from "@prisma/client";
import { DEFAULT_CEO_EMAIL, hashDefaultCeoPassword } from "@/lib/default-ceo-credentials";
import { prisma } from "@/lib/prisma";

/**
 * Jika belum ada baris untuk `DEFAULT_CEO_EMAIL`, buat akun CEO dengan kata sandi bootstrap.
 * Tidak mengubah kata sandi bila akun sudah ada.
 */
export async function ensureDefaultCeoUserExists() {
  const existing = await prisma.user.findUnique({
    where: { email: DEFAULT_CEO_EMAIL },
    select: { id: true },
  });
  if (existing) return;
  const passwordHash = await hashDefaultCeoPassword();
  await prisma.user.create({
    data: {
      email: DEFAULT_CEO_EMAIL,
      name: "CEO",
      passwordHash,
      role: UserRole.CEO,
    },
  });
}
