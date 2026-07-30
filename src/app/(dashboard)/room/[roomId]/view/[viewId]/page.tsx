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
import { CalendarViewClient } from "./calendar-view-client";
import { TimelineViewClient } from "./timeline-view-client";
import { WikiViewClient } from "./wiki-view-client";
import { LinksViewClient } from "./links-view-client";
import { ListViewClient } from "./list-view-client";
import { GlossaryViewClient } from "./glossary-view-client";
import { WhiteboardViewClient } from "@/components/whiteboard/whiteboard-view-client";

type PageProps = {
  params: Promise<{ roomId: string; viewId: string }>;
};

export default async function RoomCustomViewPage({ params }: PageProps) {
  const { roomId, viewId } = await params;
  const { role, viewerUserId } = await getRoomMemberContextOrThrow(roomId);

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
        {await renderWhiteboardBody(roomId, view.id, viewerUserId)}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <RoomViewHeader view={view} canManage={canManage} />
      {await renderViewBody(roomId, view, canManage, viewerUserId)}
    </div>
  );
}

const MAX_INITIAL_ELEMENTS = 10_000;

async function renderWhiteboardBody(
  roomId: string,
  viewId: string,
  viewerUserId: string,
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

  const activeBoard = boards[0] ?? null;
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
) {
  switch (view.type) {
    case RoomViewType.CALENDAR: {
      const events = await prisma.roomCalendarEvent.findMany({
        where: { viewId: view.id },
        orderBy: { startsAt: "asc" },
      });
      return (
        <CalendarViewClient
          viewId={view.id}
          events={events.map((e) => ({
            id: e.id,
            title: e.title,
            description: e.description,
            location: e.location,
            startsAt: e.startsAt.toISOString(),
            endsAt: e.endsAt ? e.endsAt.toISOString() : null,
            allDay: e.allDay,
          }))}
        />
      );
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
