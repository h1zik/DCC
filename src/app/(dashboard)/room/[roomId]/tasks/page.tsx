import Link from "next/link";
import { redirect } from "next/navigation";
import { RoomMemberRole } from "@prisma/client";
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
import { auth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { TasksWorkspace } from "../../../tasks/tasks-workspace";

type PageProps = {
  params: Promise<{ roomId: string }>;
  searchParams: Promise<{ process?: string | string[] }>;
};

export default async function RoomTasksPage({ params, searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id: uid } = session.user;
  const { roomId } = await params;
  const sp = await searchParams;
  const { room, role, allowedRoomProcesses } =
    await getRoomMemberContextOrThrow(roomId);
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

  if (simpleHub) {
    const canManageRoomTasks = isRoomHubManagerRole(role);

    const [tasks, projects, memberRows, vendors] = await Promise.all([
      prisma.task.findMany({
        where: { project: { roomId } },
        orderBy: [
          { projectId: "asc" },
          { sortOrder: "asc" },
          { createdAt: "desc" },
        ],
        include: {
          project: { include: { brand: true, room: { select: { name: true } } } },
          assignee: { select: { id: true, name: true, email: true, image: true } },
          vendor: { select: { id: true, name: true } },
          checklistItems: { orderBy: { sortOrder: "asc" } },
          comments: {
            orderBy: { createdAt: "desc" },
            include: {
              author: { select: { id: true, name: true, email: true } },
            },
          },
          attachments: {
            orderBy: { createdAt: "desc" },
            include: {
              uploadedBy: { select: { id: true, name: true, email: true } },
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
          roomTitle={room.name}
          simpleHub
          projects={projects}
          users={users}
          vendors={vendors}
          isRoomManager={canManageRoomTasks}
          currentUserId={uid}
          tasks={tasks}
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
    redirect(`/room/${roomId}/tasks?process=${activeProcess}`);
  }

  const canManageRoomTasks = isRoomHubManagerRole(role);

  const [tasks, projects, contributorMembers, vendors] = await Promise.all([
    prisma.task.findMany({
      where: { project: { roomId }, roomProcess: activeProcess },
      orderBy: [
        { projectId: "asc" },
        { sortOrder: "asc" },
        { createdAt: "desc" },
      ],
      include: {
        project: { include: { brand: true, room: { select: { name: true } } } },
        assignee: { select: { id: true, name: true, email: true, image: true } },
        vendor: { select: { id: true, name: true } },
        checklistItems: { orderBy: { sortOrder: "asc" } },
        comments: {
          orderBy: { createdAt: "desc" },
          include: {
            author: { select: { id: true, name: true, email: true } },
          },
        },
        attachments: {
          orderBy: { createdAt: "desc" },
          include: {
            uploadedBy: { select: { id: true, name: true, email: true } },
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
      where: { roomId, role: RoomMemberRole.ROOM_CONTRIBUTOR },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { user: { email: "asc" } },
    }),
    prisma.vendor.findMany({ orderBy: { name: "asc" } }),
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
        roomTitle={room.name}
        activeRoomProcess={activeProcess}
        projects={projects}
        users={users}
        vendors={vendors}
        isRoomManager={canManageRoomTasks}
        currentUserId={uid}
        tasks={tasks}
      />
    </div>
  );
}
