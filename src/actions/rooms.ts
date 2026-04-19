"use server";

import { revalidatePath } from "next/cache";
import { RoomWorkspaceSection } from "@prisma/client";
import { revalidateTasksAndRoomHub } from "@/lib/revalidate-workspace";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdministrator } from "@/lib/auth-helpers";
import { ensureSimpleRoomBoardProject } from "@/lib/room-simple-hub";

const roomSchema = z.object({
  name: z.string().min(1),
  brandId: z.string().optional().nullable(),
  workspaceSection: z
    .nativeEnum(RoomWorkspaceSection)
    .default(RoomWorkspaceSection.ROOMS),
});

export async function createRoom(input: z.infer<typeof roomSchema>) {
  await requireAdministrator();
  const data = roomSchema.parse(input);
  const created = await prisma.room.create({
    data: {
      name: data.name,
      brandId: data.brandId || null,
      workspaceSection: data.workspaceSection,
    },
  });
  await ensureSimpleRoomBoardProject(created.id);
  revalidatePath("/rooms");
  revalidateTasksAndRoomHub();
  revalidatePath("/projects");
}

export async function updateRoom(
  id: string,
  input: z.infer<typeof roomSchema>,
) {
  await requireAdministrator();
  const data = roomSchema.parse(input);
  await prisma.room.update({
    where: { id },
    data: {
      name: data.name,
      brandId: data.brandId || null,
      workspaceSection: data.workspaceSection,
    },
  });
  await ensureSimpleRoomBoardProject(id);
  revalidatePath("/rooms");
  revalidateTasksAndRoomHub();
  revalidatePath("/projects");
}

export async function deleteRoom(id: string) {
  await requireAdministrator();
  const count = await prisma.project.count({ where: { roomId: id } });
  if (count > 0) {
    throw new Error(
      "Ruangan masih memiliki proyek. Pindahkan atau hapus proyek terlebih dahulu.",
    );
  }
  await prisma.room.delete({ where: { id } });
  revalidatePath("/rooms");
  revalidateTasksAndRoomHub();
}
