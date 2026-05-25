import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canUseDirectChat } from "@/lib/roles";

export { canUseDirectChat };

export async function requireDirectChatSession() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!canUseDirectChat(session.user.role)) redirect("/tasks");
  return session;
}

/** Waktu terakhir lawan bicara membaca percakapan (untuk read receipt). */
export async function getDirectChatPeerLastReadAt(
  conversationId: string,
  currentUserId: string,
): Promise<Date | null> {
  const peer = await prisma.directConversationMember.findFirst({
    where: {
      conversationId,
      userId: { not: currentUserId },
    },
    select: { lastReadAt: true },
  });
  return peer?.lastReadAt ?? null;
}

export async function assertDirectConversationMember(
  conversationId: string,
  userId: string,
) {
  const member = await prisma.directConversationMember.findUnique({
    where: {
      conversationId_userId: { conversationId, userId },
    },
    select: { id: true },
  });
  if (!member) {
    throw new Error("Percakapan tidak ditemukan atau Anda bukan peserta.");
  }
}

export async function listDirectChatEligibleUsers(excludeUserId: string) {
  const users = await prisma.user.findMany({
    where: {
      id: { not: excludeUserId },
      role: {
        in: [
          UserRole.CEO,
          UserRole.ADMINISTRATOR,
          UserRole.PROJECT_MANAGER,
          UserRole.NORMAL_USER,
          UserRole.MARKETING,
          UserRole.CREATIVE_DIRECTOR,
          UserRole.BUSINESS_ANALYST,
          UserRole.COPYWRITER,
        ],
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      lastSeenAt: true,
      role: true,
    },
    orderBy: [{ name: "asc" }, { email: "asc" }],
  });
  return users;
}
