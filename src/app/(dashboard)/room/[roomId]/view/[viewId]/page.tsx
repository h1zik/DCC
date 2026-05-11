import { notFound } from "next/navigation";
import { RoomViewType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRoomMemberContextOrThrow } from "@/lib/ensure-room-studio";
import { isRoomHubManagerRole } from "@/lib/room-access";
import { RoomViewHeader } from "./room-view-header";
import { CalendarViewClient } from "./calendar-view-client";
import { TimelineViewClient } from "./timeline-view-client";
import { WikiViewClient } from "./wiki-view-client";
import { LinksViewClient } from "./links-view-client";
import { ListViewClient } from "./list-view-client";
import { GlossaryViewClient } from "./glossary-view-client";

type PageProps = {
  params: Promise<{ roomId: string; viewId: string }>;
};

export default async function RoomCustomViewPage({ params }: PageProps) {
  const { roomId, viewId } = await params;
  const { role } = await getRoomMemberContextOrThrow(roomId);

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

  return (
    <div className="flex flex-col gap-4">
      <RoomViewHeader view={view} canManage={canManage} />
      {await renderViewBody(view, canManage)}
    </div>
  );
}

async function renderViewBody(
  view: {
    id: string;
    roomId: string;
    type: RoomViewType;
    title: string;
    subtitle: string | null;
  },
  canManage: boolean,
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
      const pages = await prisma.roomWikiPage.findMany({
        where: { viewId: view.id },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      });
      return (
        <WikiViewClient
          viewId={view.id}
          pages={pages.map((p) => ({
            id: p.id,
            title: p.title,
            content: p.content,
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
