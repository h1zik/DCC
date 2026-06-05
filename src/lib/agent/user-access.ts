import { RoomMemberRole, UserRole, type RoomTaskProcess } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { enumRoleLabel } from "@/lib/role-labels";
import {
  buildRoomProcessPhaseList,
} from "@/lib/room-process-phase";
import { ensureRoomProcessPhases } from "@/lib/room-process-phases-seed";
import { isSimpleTeamOrHqRoom } from "@/lib/room-simple-hub";
import {
  isRoomHubManagerRole,
  memberHasRoomPhaseAccess,
  ROOM_PROJECT_MANAGER_ROLE,
  roomMemberToProcessAccess,
} from "@/lib/room-member-process-access";
import { canSeeAllRooms } from "./access";
import type { AgentUser } from "./types";

export function agentRoomRoleLabel(role: RoomMemberRole): string {
  if (role === ROOM_PROJECT_MANAGER_ROLE) return "Project Manager ruangan";
  switch (role) {
    case RoomMemberRole.ROOM_MANAGER:
      return "Manager ruangan";
    case RoomMemberRole.ROOM_CONTRIBUTOR:
      return "Kontributor";
    default:
      return role;
  }
}

export type AgentRoomAccessSummary = {
  roomId: string;
  roomName: string;
  membershipRole: string;
  membershipRoleLabel: string;
  canManageTasks: boolean;
  accessiblePhases: string[];
};

export type AgentUserAccessSummary = {
  globalRole: string;
  globalRoleLabel: string;
  hasFullAccess: boolean;
  rooms: AgentRoomAccessSummary[];
};

export async function getAgentUserAccessSummary(
  user: AgentUser,
): Promise<AgentUserAccessSummary> {
  const globalRole = user.role;
  const globalRoleLabel = enumRoleLabel(globalRole as UserRole);
  const hasFullAccess = canSeeAllRooms(user);

  if (hasFullAccess) {
    const rooms = await prisma.room.findMany({
      select: { id: true, name: true, brandId: true, workspaceSection: true },
      orderBy: { name: "asc" },
      take: 30,
    });

    const roomSummaries: AgentRoomAccessSummary[] = [];
    for (const room of rooms) {
      let phases: string[] = ["Tasks"];
      if (!isSimpleTeamOrHqRoom(room)) {
        const rows = await ensureRoomProcessPhases(room.id);
        phases = buildRoomProcessPhaseList(rows).map((p) => p.name);
      }
      roomSummaries.push({
        roomId: room.id,
        roomName: room.name,
        membershipRole: globalRole,
        membershipRoleLabel: globalRoleLabel,
        canManageTasks: true,
        accessiblePhases: phases,
      });
    }

    return {
      globalRole,
      globalRoleLabel,
      hasFullAccess: true,
      rooms: roomSummaries,
    };
  }

  const memberships = await prisma.roomMember.findMany({
    where: { userId: user.id },
    select: {
      role: true,
      allowedRoomProcesses: true,
      allowedCustomProcessPhaseIds: true,
      room: {
        select: { id: true, name: true, brandId: true, workspaceSection: true },
      },
    },
    orderBy: { room: { name: "asc" } },
  });

  const roomSummaries: AgentRoomAccessSummary[] = [];

  for (const m of memberships) {
    const access = roomMemberToProcessAccess(m);
    let accessiblePhases: string[] = [];

    if (isSimpleTeamOrHqRoom(m.room)) {
      accessiblePhases = ["Tasks"];
    } else {
      const phases = await ensureRoomProcessPhases(m.room.id);
      accessiblePhases = buildRoomProcessPhaseList(phases)
        .filter((phase) => memberHasRoomPhaseAccess(access, phase))
        .map((p) => p.name);
    }

    roomSummaries.push({
      roomId: m.room.id,
      roomName: m.room.name,
      membershipRole: m.role,
      membershipRoleLabel: agentRoomRoleLabel(m.role),
      canManageTasks: isRoomHubManagerRole(m.role),
      accessiblePhases,
    });
  }

  return {
    globalRole,
    globalRoleLabel,
    hasFullAccess: false,
    rooms: roomSummaries,
  };
}

export function formatAgentAccessForPrompt(
  summary: AgentUserAccessSummary,
): string {
  if (summary.hasFullAccess) {
    return `Akses: ${summary.globalRoleLabel} (akses penuh semua ruangan & fase).`;
  }

  if (summary.rooms.length === 0) {
    return `Akses: ${summary.globalRoleLabel} — belum tergabung di ruangan manapun.`;
  }

  const lines = summary.rooms.map((r) => {
    const phases =
      r.accessiblePhases.length > 0
        ? r.accessiblePhases.join(", ")
        : "belum ada fase";
    const manage = r.canManageTasks ? "bisa buat tugas" : "tidak bisa buat tugas";
    return `- ${r.roomName}: peran ${r.membershipRoleLabel}, fase [${phases}], ${manage}`;
  });

  return `Akses pengguna (${summary.globalRoleLabel}):\n${lines.join("\n")}`;
}

export type AccessiblePhaseRef = { id: string; name: string };

export async function getUserAccessiblePhasesInRoom(
  user: AgentUser,
  roomId: string,
): Promise<AccessiblePhaseRef[]> {
  const room = await prisma.room.findUniqueOrThrow({
    where: { id: roomId },
    select: { brandId: true, workspaceSection: true },
  });

  if (isSimpleTeamOrHqRoom(room)) {
    return [{ id: "simple-hub", name: "Tasks" }];
  }

  const phases = await ensureRoomProcessPhases(roomId);
  const phaseList = buildRoomProcessPhaseList(phases);

  if (canSeeAllRooms(user)) {
    return phaseList.map((p) => ({ id: p.id, name: p.name }));
  }

  const member = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId: user.id } },
    select: {
      role: true,
      allowedRoomProcesses: true,
      allowedCustomProcessPhaseIds: true,
    },
  });

  if (!member) return [];

  const access = roomMemberToProcessAccess(member);
  return phaseList
    .filter((phase) => memberHasRoomPhaseAccess(access, phase))
    .map((p) => ({ id: p.id, name: p.name }));
}

export async function userCanAccessTaskPhase(
  user: AgentUser,
  roomId: string,
  phase: { id: string; name: string; legacyProcessKey?: RoomTaskProcess | null },
): Promise<boolean> {
  if (canSeeAllRooms(user)) return true;

  const member = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId: user.id } },
    select: {
      role: true,
      allowedRoomProcesses: true,
      allowedCustomProcessPhaseIds: true,
    },
  });
  if (!member) return false;

  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { brandId: true, workspaceSection: true },
  });
  if (room && isSimpleTeamOrHqRoom(room)) return true;

  return memberHasRoomPhaseAccess(roomMemberToProcessAccess(member), phase);
}
