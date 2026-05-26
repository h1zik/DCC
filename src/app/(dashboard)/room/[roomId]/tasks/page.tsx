import { redirect } from "next/navigation";
import {
  RoomMemberRole,
  RoomTaskProcess,
  TaskWorkspaceView,
  TaskStatus,
} from "@prisma/client";
import { KanbanSquare, Workflow } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getRoomMemberContextOrThrow } from "@/lib/ensure-room-studio";
import { isRoomHubManagerRole, roomMemberToProcessAccess } from "@/lib/room-access";
import { ROOM_PROJECT_MANAGER_ROLE } from "@/lib/room-member-process-access";
import {
  buildRoomProcessPhaseList,
  defaultRoomProcessPhaseRef,
  parseRoomProcessPhaseParam,
  roomProcessPhaseKey,
  taskPhaseWhere,
} from "@/lib/room-process-phase";
import { memberHasRoomPhaseAccess } from "@/lib/room-member-process-access";
import {
  ensureSimpleRoomBoardProject,
  isSimpleTeamOrHqRoom,
} from "@/lib/room-simple-hub";
import {
  getRoomKanbanColumns,
  getSimpleHubKanbanColumns,
} from "@/lib/room-kanban-columns";
import { ensureRoomProcessPhases } from "@/lib/room-process-phases-seed";
import { TasksWorkspace } from "../../../tasks/tasks-workspace";
import { RoomTasksProcessNav } from "./room-tasks-process-nav";

function TasksHero({
  title,
  subtitle,
  hint,
}: {
  title: string;
  subtitle: string;
  hint: string;
}) {
  return (
    <header className="border-border bg-card relative isolate overflow-hidden rounded-2xl border shadow-sm">
      <div
        className="bg-gradient-to-br from-primary/10 via-primary/5 absolute inset-0 to-transparent"
        aria-hidden
      />
      <div
        className="bg-gradient-to-r from-transparent via-primary/40 to-transparent absolute inset-x-0 top-0 h-px"
        aria-hidden
      />
      <div className="relative flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6 sm:p-5">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="border-primary/30 bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl border"
            aria-hidden
          >
            <KanbanSquare className="size-5" />
          </span>
          <div className="min-w-0 space-y-1">
            <h2 className="text-foreground text-base font-semibold tracking-tight sm:text-lg">
              {title}
            </h2>
            <p className="text-muted-foreground text-pretty text-sm leading-relaxed">
              {subtitle}
            </p>
          </div>
        </div>
        <div className="border-primary/25 bg-primary/8 text-primary inline-flex max-w-md items-start gap-2 self-start rounded-lg border px-3 py-2 text-[12px] leading-relaxed sm:max-w-sm">
          <Workflow className="mt-[1px] size-3.5 shrink-0" aria-hidden />
          <span>{hint}</span>
        </div>
      </div>
    </header>
  );
}

type PageProps = {
  params: Promise<{ roomId: string }>;
  searchParams: Promise<{
    process?: string | string[];
    archived?: string | string[];
  }>;
};

export default async function RoomTasksPage({ params, searchParams }: PageProps) {
  const { roomId } = await params;
  const sp = await searchParams;
  const {
    room,
    role,
    allowedRoomProcesses,
    allowedCustomProcessPhaseIds,
    viewerUserId: uid,
  } = await getRoomMemberContextOrThrow(roomId);
  const viewerPreference = await prisma.user.findUnique({
    where: { id: uid },
    select: { taskDefaultWorkspaceView: true },
  });
  const defaultTaskView =
    viewerPreference?.taskDefaultWorkspaceView ?? TaskWorkspaceView.KANBAN;
  const simpleHub = isSimpleTeamOrHqRoom(room);

  if (simpleHub) {
    await ensureSimpleRoomBoardProject(roomId);
    if (sp.process) {
      redirect(`/room/${roomId}/tasks`);
    }
  }

  const customPhases = simpleHub ? [] : await ensureRoomProcessPhases(roomId);

  const accessMember = roomMemberToProcessAccess({
    role,
    allowedRoomProcesses,
    allowedCustomProcessPhaseIds,
  });
  const allPhases = buildRoomProcessPhaseList(customPhases);
  const accessiblePhases = allPhases.filter((phase) =>
    memberHasRoomPhaseAccess(accessMember, phase),
  );

  if (!simpleHub && accessiblePhases.length === 0) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
        <p className="font-medium text-amber-950 dark:text-amber-50">
          Belum ada akses fase tugas
        </p>
        <p className="text-muted-foreground text-pretty">
          Administrator belum menetapkan fase proses yang dapat Anda akses di
          ruangan ini, atau daftar akses Anda kosong. Hubungi administrator
          melalui menu{" "}
          <span className="text-foreground font-medium">Ruang kerja</span> agar
          peran dan fase proses Anda diatur.
        </p>
      </div>
    );
  }

  const archivedParam = Array.isArray(sp.archived)
    ? sp.archived[0]
    : sp.archived;
  const showArchived = archivedParam === "1" || archivedParam === "true";

  if (simpleHub) {
    const canManageRoomTasks = isRoomHubManagerRole(role);

    const archivedWhere = showArchived
      ? { archivedAt: { not: null }, status: TaskStatus.DONE }
      : { archivedAt: null };

    const [tasks, projects, memberRows, vendors, kanbanColumns, roomTaskTags] =
      await Promise.all([
      prisma.task.findMany({
        where: { project: { roomId }, ...archivedWhere },
        orderBy: [
          { projectId: "asc" },
          { sortOrder: "asc" },
          { createdAt: "desc" },
        ],
        // `comments` & `attachments` SENGAJA tidak di-include di SSR daftar
        // tugas — terlalu berat (lihat `task-list-query.ts`). Detail sheet
        // me-lazy-load via `loadTaskDetail()` saat dibuka.
        include: {
          project: { include: { brand: true, room: { select: { name: true } } } },
          assignees: {
            include: {
              user: { select: { id: true, name: true, email: true, image: true } },
            },
          },
          vendor: { select: { id: true, name: true } },
          checklistItems: { orderBy: { sortOrder: "asc" } },
          tags: {
            include: {
              tag: { select: { id: true, roomId: true, name: true, colorHex: true } },
            },
          },
        },
      }),
      prisma.project.findMany({
        where: { roomId, brandId: null },
        include: { brand: true, room: { select: { name: true } } },
        orderBy: { name: "asc" },
      }),
      prisma.roomMember.findMany({
        where: { roomId },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { user: { email: "asc" } },
      }),
      prisma.vendor.findMany({ orderBy: { name: "asc" } }),
      getSimpleHubKanbanColumns(roomId),
      prisma.taskTag.findMany({
        where: { roomId },
        orderBy: [{ name: "asc" }],
        select: { id: true, roomId: true, name: true, colorHex: true },
      }),
    ]);

    const seen = new Set<string>();
    const users = memberRows
      .map((row) => row.user)
      .filter((u) => {
        if (seen.has(u.id)) return false;
        seen.add(u.id);
        return true;
      });

    return (
      <div className="flex flex-col gap-4">
        <TasksHero
          title="Tasks ruangan"
          subtitle="Mode sederhana tanpa fase proses — gunakan Kanban, daftar, atau Gantt untuk merencanakan pekerjaan."
          hint="Obrolan grup dan dokumen tersedia di menu atas ruangan."
        />
        <TasksWorkspace
          roomId={roomId}
          roomTitle={room.name}
          simpleHub
          projects={projects}
          users={users}
          vendors={vendors}
          isRoomManager={canManageRoomTasks}
          currentUserId={uid}
          tasks={tasks}
          kanbanColumns={kanbanColumns}
          showArchived={showArchived}
          defaultTaskView={defaultTaskView}
          roomTaskTags={roomTaskTags}
        />
      </div>
    );
  }

  const requestedPhase =
    parseRoomProcessPhaseParam(sp.process, customPhases) ??
    defaultRoomProcessPhaseRef(customPhases);

  const requestedKey = roomProcessPhaseKey(requestedPhase);
  const activePhase =
    accessiblePhases.find((p) => roomProcessPhaseKey(p) === requestedKey) ??
    accessiblePhases[0]!;

  if (roomProcessPhaseKey(activePhase) !== requestedKey) {
    const qs = new URLSearchParams();
    qs.set("process", roomProcessPhaseKey(activePhase));
    if (showArchived) qs.set("archived", "1");
    redirect(`/room/${roomId}/tasks?${qs.toString()}`);
  }

  const canManageRoomTasks = isRoomHubManagerRole(role);

  const archivedWhere = showArchived
    ? { archivedAt: { not: null }, status: TaskStatus.DONE }
    : { archivedAt: null };

  const [tasks, projects, contributorMembers, vendors, kanbanColumns, roomTaskTags] =
    await Promise.all([
    prisma.task.findMany({
      where: {
        project: { roomId },
        ...taskPhaseWhere(activePhase),
        ...archivedWhere,
      },
      orderBy: [
        { projectId: "asc" },
        { sortOrder: "asc" },
        { createdAt: "desc" },
      ],
      // Lihat catatan di blok `simpleHub` di atas: `comments`/`attachments`
      // sengaja diabaikan agar payload SSR ringan.
      include: {
        project: { include: { brand: true, room: { select: { name: true } } } },
        assignees: {
          include: {
            user: { select: { id: true, name: true, email: true, image: true } },
          },
        },
        vendor: { select: { id: true, name: true } },
        checklistItems: { orderBy: { sortOrder: "asc" } },
        tags: {
          include: {
            tag: { select: { id: true, roomId: true, name: true, colorHex: true } },
          },
        },
      },
    }),
    prisma.project.findMany({
      where: { roomId },
      include: { brand: true, room: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.roomMember.findMany({
      where: {
        roomId,
        role: {
          in: [
            RoomMemberRole.ROOM_CONTRIBUTOR,
            RoomMemberRole.ROOM_MANAGER,
            RoomMemberRole.ROOM_PROJECT_MANAGER,
          ],
        },
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { user: { email: "asc" } },
    }),
    prisma.vendor.findMany({ orderBy: { name: "asc" } }),
    getRoomKanbanColumns(roomId, activePhase),
    prisma.taskTag.findMany({
      where: { roomId },
      orderBy: [{ name: "asc" }],
      select: { id: true, roomId: true, name: true, colorHex: true },
    }),
  ]);

  const users = contributorMembers
    .filter((row) =>
      memberHasRoomPhaseAccess(roomMemberToProcessAccess(row), activePhase),
    )
    .map((row) => row.user);

  const roleHint =
    role === ROOM_PROJECT_MANAGER_ROLE
      ? "Sebagai project manager ruangan Anda memegang semua fase proses, membuat tugas, dan menetapkan PIC."
      : role === RoomMemberRole.ROOM_MANAGER
        ? "Sebagai manager ruangan Anda mengelola tugas pada fase yang diizinkan administrator."
        : "Sebagai kontributor Anda dapat memindahkan status tugas, mengisi komentar, lampiran, dan sub-tugas.";

  return (
    <div className="flex flex-col gap-4">
      <TasksHero
        title="Tasks ruangan"
        subtitle="Kanban, daftar, dan Gantt per fase proses. Klik kartu (grip untuk seret di Kanban) untuk detail tugas."
        hint={roleHint}
      />
      <RoomTasksProcessNav
        roomId={roomId}
        phases={accessiblePhases}
        activePhase={activePhase}
        showArchived={showArchived}
        canManagePhases={canManageRoomTasks}
      />
      <TasksWorkspace
        roomId={roomId}
        roomTitle={room.name}
        activePhase={activePhase}
        projects={projects}
        users={users}
        vendors={vendors}
        isRoomManager={canManageRoomTasks}
        currentUserId={uid}
        tasks={tasks}
        kanbanColumns={kanbanColumns}
        showArchived={showArchived}
        defaultTaskView={defaultTaskView}
        roomTaskTags={roomTaskTags}
      />
    </div>
  );
}
