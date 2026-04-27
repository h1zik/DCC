import { UserRole } from "@prisma/client";
import { auth } from "@/lib/auth";
import {
  isAdministrator,
  isProjectManager,
  isStudioOrProjectManager,
} from "@/lib/roles";

export async function requireLogisticsStaff() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Belum masuk.");
  }
  if (session.user.role !== UserRole.LOGISTICS) {
    throw new Error("Hanya staf logistik yang dapat melakukan aksi ini.");
  }
  return session;
}

/** Master brand — CEO atau logistik. */
export async function requireCeoOrLogisticsStaff() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Belum masuk.");
  }
  const role = session.user.role;
  if (role !== UserRole.CEO && role !== UserRole.LOGISTICS) {
    throw new Error("Hanya CEO atau staf logistik yang dapat mengelola brand.");
  }
  return session;
}

/** Tim studio atau Project Manager (akses tugas, ruangan, pipeline). */
export async function requireStudioTeam() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Belum masuk.");
  }
  if (!isStudioOrProjectManager(session.user.role)) {
    throw new Error(
      "Hanya tim studio atau project manager yang dapat melakukan aksi ini.",
    );
  }
  return session;
}

/** Mutasi di hub ruangan / Kanban — CEO (akses penuh) atau tim studio / PM. */
export async function requireTasksRoomHubSession() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Belum masuk.");
  }
  const role = session.user.role;
  if (
    role !== UserRole.CEO &&
    !isAdministrator(role) &&
    !isStudioOrProjectManager(role)
  ) {
    throw new Error(
      "Hanya CEO, administrator, tim studio, atau project manager yang dapat melakukan aksi ini.",
    );
  }
  return session;
}

export async function requireProjectManager() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Belum masuk.");
  }
  if (!isProjectManager(session.user.role)) {
    throw new Error("Hanya project manager yang dapat menetapkan PIC tugas.");
  }
  return session;
}

/** Administrator atau Project Manager. */
export async function requireAdministratorOrProjectManager() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Belum masuk.");
  }
  if (!isAdministrator(session.user.role) && !isProjectManager(session.user.role)) {
    throw new Error("Hanya administrator atau project manager yang dapat melakukan aksi ini.");
  }
  return session;
}

/** CEO atau tim studio / project manager — CRUD proyek pipeline. */
export async function requireProjectEditor() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Belum masuk.");
  }
  const role = session.user.role;
  if (role !== UserRole.CEO && !isStudioOrProjectManager(role)) {
    throw new Error("Anda tidak memiliki akses mengubah proyek pipeline.");
  }
  return session;
}

export async function requireCeo() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Belum masuk.");
  }
  if (session.user.role !== UserRole.CEO) {
    throw new Error("Hanya CEO yang dapat melakukan aksi ini.");
  }
  return session;
}

/** Master brand & ruang kerja — administrator. */
export async function requireAdministrator() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Belum masuk.");
  }
  if (session.user.role !== UserRole.ADMINISTRATOR) {
    throw new Error("Hanya administrator yang dapat melakukan aksi ini.");
  }
  return session;
}
