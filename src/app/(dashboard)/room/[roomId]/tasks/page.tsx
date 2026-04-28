import Link from "next/link";
import { redirect } from "next/navigation";
import {
  RoomMemberRole,
  RoomTaskProcess,
  TaskWorkspaceView,
  TaskStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRoomMemberContextOrThrow } from "@/lib/ensure-room-studio";
import {
  isRoomHubManagerRole,
  memberHasRoomProcessAccess,
  roomMemberToProcessAccess,
} from "@/lib/room-access";
import { ROOM_PROJECT_MANAGER_ROLE } from "@/lib/room-member-process-access";
import {
  defaultRoomTaskProcess,
  parseRoomTaskProcessParam,
  roomTaskProcessLabel,
  ROOM_TASK_PROCESS_ORDER,
} from "@/lib/room-task-process";
import {
  ensureSimpleRoomBoardProject,
  isSimpleTeamOrHqRoom,
} from "@/lib/room-simple-hub";
import {
  TASK_LIST_ATTACHMENTS_TAKE,
  TASK_LIST_COMMENTS_TAKE,
} from "@/lib/task-list-query";
import { cn } from "@/lib/utils";
import { getRoomKanbanColumns } from "@/lib/room-kanban-columns";
import { TasksWorkspace } from "../../../tasks/tasks-workspace";

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
  const { room, role, allowedRoomProcesses, viewerUserId: uid } =
    await getRoomMemberContextOrThrow(roomId);
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

  const accessMember = roomMemberToProcessAccess({ role, allowedRoomProcesses });
  const accessibleProcesses = ROOM_TASK_PROCESS_ORDER.filter((p) =>
    memberHasRoomProcessAccess(accessMember, p),
  );

  if (!simpleHub && accessibleProcesses.length === 0) {
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
        include: {
          project: { include: { brand: true, room: { select: { name: true } } } },
          assignees: {
            include: {
              user: { select: { id: true, name: true, email: true, image: true } },
            },
          },
          vendor: { select: { id: true, name: true } },
          checklistItems: { orderBy: { sortOrder: "asc" } },
          comments: {
            orderBy: { createdAt: "desc" },
            take: TASK_LIST_COMMENTS_TAKE,
            include: {
              author: { select: { id: true, name: true, email: true } },
            },
          },
          attachments: {
            orderBy: { createdAt: "desc" },
            take: TASK_LIST_ATTACHMENTS_TAKE,
            include: {
              uploadedBy: { select: { id: true, name: true, email: true } },
            },
          },
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
      getRoomKanbanColumns(roomId, RoomTaskProcess.MARKET_RESEARCH),
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
        <p className="text-muted-foreground text-sm">
          Mode tugas sederhana untuk ruangan HQ/Team tanpa brand: tidak ada fase
          Market Research dan seterusnya. Gunakan Kanban, daftar, atau Gantt;
          obrolan dan dokumen ada di menu atas.
        </p>
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

  const requestedProcess =
    parseRoomTaskProcessParam(sp.process) ?? defaultRoomTaskProcess();

  const activeProcess = accessibleProcesses.includes(requestedProcess)
    ? requestedProcess
    : accessibleProcesses[0]!;

  if (activeProcess !== requestedProcess) {
    const qs = new URLSearchParams();
    qs.set("process", activeProcess);
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
        roomProcess: activeProcess,
        ...archivedWhere,
      },
      orderBy: [
        { projectId: "asc" },
        { sortOrder: "asc" },
        { createdAt: "desc" },
      ],
      include: {
        project: { include: { brand: true, room: { select: { name: true } } } },
        assignees: {
          include: {
            user: { select: { id: true, name: true, email: true, image: true } },
          },
        },
        vendor: { select: { id: true, name: true } },
        checklistItems: { orderBy: { sortOrder: "asc" } },
        comments: {
          orderBy: { createdAt: "desc" },
          take: TASK_LIST_COMMENTS_TAKE,
          include: {
            author: { select: { id: true, name: true, email: true } },
          },
        },
        attachments: {
          orderBy: { createdAt: "desc" },
          take: TASK_LIST_ATTACHMENTS_TAKE,
          include: {
            uploadedBy: { select: { id: true, name: true, email: true } },
          },
        },
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
    getRoomKanbanColumns(roomId, activeProcess),
    prisma.taskTag.findMany({
      where: { roomId },
      orderBy: [{ name: "asc" }],
      select: { id: true, roomId: true, name: true, colorHex: true },
    }),
  ]);

  const users = contributorMembers
    .filter((row) =>
      memberHasRoomProcessAccess(
        roomMemberToProcessAccess(row),
        activeProcess,
      ),
    )
    .map((row) => row.user);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        Kanban, daftar, dan Gantt untuk ruangan ini. Klik kartu (grip untuk seret
        di Kanban) untuk detail tugas.{" "}
        {role === ROOM_PROJECT_MANAGER_ROLE
          ? "Sebagai project manager ruangan Anda memiliki akses semua fase proses, dapat membuat tugas, menetapkan PIC (kontributor dengan akses fase yang sama), serta moderasi."
          : role === RoomMemberRole.ROOM_MANAGER
            ? "Sebagai manager ruangan Anda dapat mengelola tugas pada fase yang ditetapkan administrator, termasuk membuat tugas dan menetapkan PIC (kontributor dengan akses fase tersebut)."
            : "Sebagai kontributor Anda dapat memindahkan status tugas pada fase yang ditetapkan administrator serta mengisi komentar, lampiran, dan sub-tugas."}
      </p>
      <nav
        aria-label="Proses alur ruangan"
        className="flex flex-wrap gap-2 border-b pb-3"
      >
        {accessibleProcesses.map((p) => {
          const active = p === activeProcess;
          return (
            <Link
              key={p}
              href={`/room/${roomId}/tasks?process=${p}`}
              scroll={false}
              className={cn(
                "focus-visible:ring-ring rounded-md border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:bg-muted/60 border-border hover:text-foreground",
              )}
            >
              {roomTaskProcessLabel(p)}
            </Link>
          );
        })}
      </nav>
      <TasksWorkspace
        roomId={roomId}
        roomTitle={room.name}
        activeRoomProcess={activeProcess}
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
