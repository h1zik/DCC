import "server-only";

import { ContentPlanStatusKerja } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRoomHubMemberUsers } from "@/lib/ensure-room-studio";
import { hasLabCapability } from "@/lib/lab-access";
import { listCalendarSchedules } from "@/lib/kol/readers";
import { formatWibTime, wibDayKey } from "@/lib/kol/time";
import { dateOnlyKey } from "@/lib/room-calendar/dates";
import type { CalendarData } from "@/lib/room-calendar/types";

const DAY_MS = 86_400_000;
/** Jendela lapisan baca-saja: ±6 bulan ke belakang, 18 bulan ke depan. */
const LAYER_PAST_DAYS = 183;
const LAYER_FUTURE_DAYS = 548;

const TENTATIVE_KOL = new Set(["DRAFT", "PENDING_APPROVAL"]);

/**
 * Data satu view Kalender. Acara dan campaign milik view dimuat seluruhnya
 * (jumlahnya kecil); lapisan Content Plan dan jadwal KOL hanya dalam jendela
 * waktu di atas dan hanya dibaca, tidak pernah ditulis dari kalender.
 */
export async function loadCalendarData(
  roomId: string,
  viewId: string,
  room: { brandId?: string | null },
): Promise<CalendarData> {
  const now = Date.now();
  const from = new Date(now - LAYER_PAST_DAYS * DAY_MS);
  const to = new Date(now + LAYER_FUTURE_DAYS * DAY_MS);

  // Jadwal KOL hanya untuk yang memang punya akses KOL Hub; tanpa itu datanya
  // tidak dikirim sama sekali (bukan sekadar disembunyikan di klien).
  const canSeeKol = room.brandId ? await hasLabCapability("lab.kol") : false;

  const [events, campaigns, members, contentItems, planViews, kolRows] = await Promise.all([
    prisma.roomCalendarEvent.findMany({
      where: { viewId },
      orderBy: { startsAt: "asc" },
    }),
    prisma.roomCampaign.findMany({
      where: { viewId },
      orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
    }),
    getRoomHubMemberUsers(roomId),
    prisma.roomContentPlanItem.findMany({
      where: {
        roomId,
        archivedAt: null,
        tanggalPosting: { gte: from, lte: to },
      },
      orderBy: { tanggalPosting: "asc" },
      take: 1500,
      select: {
        id: true,
        konten: true,
        jenisKonten: true,
        platforms: true,
        tanggalPosting: true,
        jamPosting: true,
        viewId: true,
        statusCopywriting: true,
        statusDesign: true,
      },
    }),
    prisma.roomView.findMany({
      where: { roomId, type: "CONTENT_PLAN" },
      select: { id: true, title: true },
    }),
    canSeeKol && room.brandId
      ? listCalendarSchedules({ brandId: room.brandId, from, to })
      : Promise.resolve(null),
  ]);

  const planTitle = new Map(planViews.map((v) => [v.id, v.title] as const));

  return {
    events: events.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      location: e.location,
      startsAt: e.startsAt.toISOString(),
      endsAt: e.endsAt ? e.endsAt.toISOString() : null,
      allDay: e.allDay,
      campaignId: e.campaignId,
      kind: e.kind,
      doneAt: e.doneAt ? e.doneAt.toISOString() : null,
    })),
    campaigns: campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      startDate: dateOnlyKey(c.startDate),
      endDate: dateOnlyKey(c.endDate),
      color: c.color,
      status: c.status,
      objective: c.objective,
      channels: c.channels,
      picUserIds: c.picUserIds,
      budget: c.budget == null ? null : c.budget.toNumber(),
      kpiTarget: c.kpiTarget,
    })),
    members: members.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      image: m.image,
    })),
    contentPosts: contentItems.flatMap((item) => {
      if (!item.tanggalPosting) return [];
      return [
        {
          id: item.id,
          title: item.konten.trim() || "Konten tanpa judul",
          day: wibDayKey(item.tanggalPosting),
          time: item.jamPosting?.trim() || null,
          jenis: item.jenisKonten,
          platforms: item.platforms,
          published:
            item.statusCopywriting === ContentPlanStatusKerja.DIPUBLIKASIKAN &&
            item.statusDesign === ContentPlanStatusKerja.DIPUBLIKASIKAN,
          href: item.viewId
            ? `/room/${roomId}/view/${item.viewId}`
            : `/room/${roomId}/content-planning`,
          planTitle: item.viewId ? (planTitle.get(item.viewId) ?? null) : null,
        },
      ];
    }),
    kolPosts: kolRows
      ? kolRows.flatMap((r) => {
          if (!r.scheduledAt) return [];
          return [
            {
              id: r.id,
              day: wibDayKey(r.scheduledAt),
              time: formatWibTime(r.scheduledAt),
              handle: r.handle,
              kolName: r.kolName,
              campaignTitle: r.campaignTitle,
              posted: r.status === "POSTED",
              tentative: TENTATIVE_KOL.has(r.status),
            },
          ];
        })
      : null,
  };
}
