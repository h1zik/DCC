import { notFound } from "next/navigation";
import { RoomViewType } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getRoomHubMemberUsers,
  getRoomMemberContextOrThrow,
} from "@/lib/ensure-room-studio";
import { isRoomHubManagerRole } from "@/lib/room-access";
import { rowToElement } from "@/lib/whiteboard/serialize";
import { RoomViewHeader } from "./room-view-header";
import { CalendarViewClient } from "./calendar/calendar-view-client";
import { loadCalendarData } from "./calendar/calendar-data";
import { TimelineViewClient } from "./timeline-view-client";
import { WikiViewClient } from "./wiki-view-client";
import { LinksViewClient } from "./links-view-client";
import { ListViewClient } from "./list-view-client";
import { GlossaryViewClient } from "./glossary-view-client";
import { WhiteboardViewClient } from "@/components/whiteboard/whiteboard-view-client";
import { ContentPlanningClient } from "../../content-planning/content-planning-client";
import { loadContentPlanData } from "../../content-planning/content-plan-data";

type PageProps = {
  params: Promise<{ roomId: string; viewId: string }>;
  /** `?board=<id>` membuka papan tertentu (tautan yang bisa dibagikan). */
  searchParams: Promise<{ board?: string | string[] }>;
};

export default async function RoomCustomViewPage({
  params,
  searchParams,
}: PageProps) {
  const { roomId, viewId } = await params;
  const { board: boardParam } = await searchParams;
  const requestedBoardId = typeof boardParam === "string" ? boardParam : null;
  const { room, role, viewerUserId } = await getRoomMemberContextOrThrow(roomId);

  const view = await prisma.roomView.findUnique({
    where: { id: viewId },
    select: {
      id: true,
      roomId: true,
      type: true,
      title: true,
      subtitle: true,
    },
  });
  if (!view || view.roomId !== roomId) {
    notFound();
  }

  const canManage = isRoomHubManagerRole(role);

  // Whiteboard mengambil tinggi penuh: kanvasnya perlu ruang sebanyak mungkin,
  // jadi header dibuat ringkas dan body-nya yang meregang.
  if (view.type === RoomViewType.WHITEBOARD) {
    return (
      <div
        data-whiteboard-view
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden"
      >
        <RoomViewHeader view={view} canManage={canManage} />
        {await renderWhiteboardBody(
          roomId,
          view.id,
          viewerUserId,
          requestedBoardId,
        )}
      </div>
    );
  }

  // Content plan memakai shell setinggi viewport yang sama dengan content plan
  // bawaan ruangan: tabel & Gantt menggulung di dalam, bukan seluruh halaman.
  if (view.type === RoomViewType.CONTENT_PLAN) {
    const data = await loadContentPlanData(roomId, view.id, room);
    return (
      <div
        data-content-plan-shell
        className="flex min-w-0 flex-col gap-4 md:min-h-0 md:flex-1 md:overflow-hidden"
      >
        <RoomViewHeader view={view} canManage={canManage} />
        <ContentPlanningClient roomId={roomId} viewId={view.id} {...data} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <RoomViewHeader view={view} canManage={canManage} />
      {await renderViewBody(roomId, view, canManage, viewerUserId, room)}
    </div>
  );
}

const MAX_INITIAL_ELEMENTS = 10_000;

async function renderWhiteboardBody(
  roomId: string,
  viewId: string,
  viewerUserId: string,
  requestedBoardId: string | null,
) {
  const [boards, session] = await Promise.all([
    prisma.roomWhiteboard.findMany({
      where: { viewId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        title: true,
        rev: true,
        background: true,
        thumbnail: true,
        updatedAt: true,
        lastEditedById: true,
      },
    }),
    auth(),
  ]);

  const editorIds = [
    ...new Set(boards.map((b) => b.lastEditedById).filter((id): id is string => Boolean(id))),
  ];
  const editors = editorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: editorIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const editorName = new Map(
    editors.map((u) => [u.id, u.name?.trim() || u.email] as const),
  );

  const activeBoard =
    boards.find((b) => b.id === requestedBoardId) ?? boards[0] ?? null;
  const elements = activeBoard
    ? await prisma.roomWhiteboardElement.findMany({
        where: { boardId: activeBoard.id, deletedAt: null },
        orderBy: { zIndex: "asc" },
        take: MAX_INITIAL_ELEMENTS,
      })
    : [];

  return (
    <WhiteboardViewClient
      roomId={roomId}
      viewId={viewId}
      boards={boards.map((b) => ({
        id: b.id,
        title: b.title,
        rev: b.rev,
        background: b.background,
        thumbnail: b.thumbnail,
        updatedAt: b.updatedAt.toISOString(),
        lastEditedByName: b.lastEditedById
          ? (editorName.get(b.lastEditedById) ?? null)
          : null,
      }))}
      activeBoard={
        activeBoard
          ? {
              id: activeBoard.id,
              title: activeBoard.title,
              rev: activeBoard.rev,
              background: activeBoard.background,
            }
          : null
      }
      activeElements={elements.map(rowToElement)}
      currentUser={{
        id: viewerUserId,
        name: session?.user?.name?.trim() || session?.user?.email || "Anggota",
        image: session?.user?.image ?? null,
      }}
    />
  );
}

async function renderViewBody(
  roomId: string,
  view: {
    id: string;
    roomId: string;
    type: RoomViewType;
    title: string;
    subtitle: string | null;
  },
  canManage: boolean,
  viewerUserId: string,
  room: { brandId?: string | null },
) {
  switch (view.type) {
    case RoomViewType.CALENDAR: {
      const data = await loadCalendarData(roomId, view.id, room);
      return <CalendarViewClient viewId={view.id} data={data} />;
    }
    case RoomViewType.TIMELINE: {
      const items = await prisma.roomTimelineMilestone.findMany({
        where: { viewId: view.id },
        orderBy: [{ date: "asc" }, { sortOrder: "asc" }],
      });
      return (
        <TimelineViewClient
          viewId={view.id}
          milestones={items.map((m) => ({
            id: m.id,
            title: m.title,
            description: m.description,
            date: m.date.toISOString(),
            status: m.status,
          }))}
        />
      );
    }
    case RoomViewType.WIKI: {
      const [pages, members] = await Promise.all([
        prisma.roomWikiPage.findMany({
          where: { viewId: view.id },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        }),
        getRoomHubMemberUsers(roomId),
      ]);
      return (
        <WikiViewClient
          roomId={roomId}
          viewId={view.id}
          currentUserId={viewerUserId}
          members={members}
          pages={pages.map((p) => ({
            id: p.id,
            parentId: p.parentId ?? null,
            title: p.title,
            content: p.content,
            tags: p.tags ?? [],
            revision: p.revision,
            updatedAt: p.updatedAt.toISOString(),
          }))}
        />
      );
    }
    case RoomViewType.LINKS: {
      const links = await prisma.roomLinkItem.findMany({
        where: { viewId: view.id },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      });
      return (
        <LinksViewClient
          viewId={view.id}
          links={links.map((l) => ({
            id: l.id,
            title: l.title,
            url: l.url,
            description: l.description,
            category: l.category,
          }))}
        />
      );
    }
    case RoomViewType.LIST: {
      const [columns, rows] = await Promise.all([
        prisma.roomListColumn.findMany({
          where: { viewId: view.id },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        }),
        prisma.roomListRow.findMany({
          where: { viewId: view.id },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        }),
      ]);
      return (
        <ListViewClient
          viewId={view.id}
          canManage={canManage}
          columns={columns.map((c) => ({
            id: c.id,
            key: c.key,
            label: c.label,
            type: c.type,
            options: c.options,
          }))}
          rows={rows.map((r) => ({
            id: r.id,
            data: (r.data ?? {}) as Record<string, unknown>,
          }))}
        />
      );
    }
    case RoomViewType.GLOSSARY: {
      const entries = await prisma.roomGlossaryEntry.findMany({
        where: { viewId: view.id },
        orderBy: { term: "asc" },
      });
      return (
        <GlossaryViewClient
          viewId={view.id}
          entries={entries.map((e) => ({
            id: e.id,
            term: e.term,
            definition: e.definition,
            examples: e.examples,
            tags: e.tags,
          }))}
        />
      );
    }
    default:
      return null;
  }
}
