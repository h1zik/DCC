"use server";

import { revalidatePath } from "next/cache";
import {
  ContentPlanUsage,
  RoomCalendarEventKind,
  RoomCampaignStatus,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTasksRoomHubSession } from "@/lib/auth-helpers";
import { assertRoomMember } from "@/lib/room-access";
import {
  CAMPAIGN_CHANNEL_KEYS,
  CAMPAIGN_COLOR_KEYS,
} from "@/lib/room-calendar/campaign-ui";
import { isDayKey, keyToUtcDate } from "@/lib/room-calendar/dates";

/**
 * Semua anggota ruangan boleh menulis ke kalender. Setiap aksi mencari view
 * dari baris yang disentuh (bukan dari `viewId` kiriman klien), lalu memeriksa
 * keanggotaan di ruangan view itu.
 */
async function ensureCalendarViewMember(viewId: string, userId: string) {
  const v = await prisma.roomView.findUniqueOrThrow({
    where: { id: viewId },
    select: { roomId: true, type: true },
  });
  if (v.type !== "CALENDAR") throw new Error("View bukan tipe Kalender.");
  await assertRoomMember(v.roomId, userId);
  return v.roomId;
}

function revalidateView(roomId: string, viewId: string) {
  revalidatePath(`/room/${roomId}/view/${viewId}`);
}

async function assertCampaignInView(campaignId: string, viewId: string) {
  const campaign = await prisma.roomCampaign.findFirst({
    where: { id: campaignId, viewId },
    select: { id: true },
  });
  if (!campaign) throw new Error("Campaign tidak ditemukan di kalender ini.");
}

const dayKeySchema = z
  .string()
  .refine(isDayKey, "Tanggal tidak valid.")
  .transform((key) => keyToUtcDate(key));

// ───────────────────────── Aktivitas ─────────────────────────

const upsertEventSchema = z.object({
  id: z.string().optional(),
  viewId: z.string().min(1),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional().nullable(),
  location: z.string().trim().max(200).optional().nullable(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().optional().nullable(),
  allDay: z.boolean().optional().default(false),
  campaignId: z.string().min(1).optional().nullable(),
  kind: z.nativeEnum(RoomCalendarEventKind).optional().default(RoomCalendarEventKind.GENERAL),
  /** Dibiarkan kosong = status selesai tidak diubah. */
  done: z.boolean().optional(),
});

export async function upsertRoomCalendarEvent(input: z.input<typeof upsertEventSchema>) {
  const session = await requireTasksRoomHubSession();
  const data = upsertEventSchema.parse(input);
  const roomId = await ensureCalendarViewMember(data.viewId, session.user.id);

  if (data.endsAt && data.endsAt.getTime() < data.startsAt.getTime()) {
    throw new Error("Waktu selesai tidak boleh sebelum waktu mulai.");
  }
  if (data.campaignId) await assertCampaignInView(data.campaignId, data.viewId);

  const fields = {
    title: data.title,
    description: data.description?.trim() || null,
    location: data.location?.trim() || null,
    startsAt: data.startsAt,
    endsAt: data.endsAt ?? null,
    allDay: data.allDay,
    campaignId: data.campaignId ?? null,
    kind: data.kind,
  };

  if (data.id) {
    // `viewId` ikut di filter: acara dari kalender lain tidak boleh tersentuh
    // hanya karena pemanggil anggota di ruangan `data.viewId`.
    const existing = await prisma.roomCalendarEvent.findFirst({
      where: { id: data.id, viewId: data.viewId },
      select: { id: true, doneAt: true },
    });
    if (!existing) throw new Error("Aktivitas tidak ditemukan di kalender ini.");
    await prisma.roomCalendarEvent.update({
      where: { id: existing.id },
      data: {
        ...fields,
        ...(data.done === undefined
          ? {}
          : { doneAt: data.done ? (existing.doneAt ?? new Date()) : null }),
      },
    });
  } else {
    await prisma.roomCalendarEvent.create({
      data: {
        ...fields,
        viewId: data.viewId,
        doneAt: data.done ? new Date() : null,
        createdById: session.user.id,
      },
    });
  }
  revalidateView(roomId, data.viewId);
}

const moveEventSchema = z.object({
  id: z.string().min(1),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().optional().nullable(),
});

/** Pindah tanggal (geser di grid bulan). */
export async function moveRoomCalendarEvent(input: z.input<typeof moveEventSchema>) {
  const session = await requireTasksRoomHubSession();
  const data = moveEventSchema.parse(input);
  const ev = await prisma.roomCalendarEvent.findUniqueOrThrow({
    where: { id: data.id },
    select: { viewId: true },
  });
  const roomId = await ensureCalendarViewMember(ev.viewId, session.user.id);
  if (data.endsAt && data.endsAt.getTime() < data.startsAt.getTime()) {
    throw new Error("Waktu selesai tidak boleh sebelum waktu mulai.");
  }
  await prisma.roomCalendarEvent.update({
    where: { id: data.id },
    data: { startsAt: data.startsAt, endsAt: data.endsAt ?? null },
  });
  revalidateView(roomId, ev.viewId);
}

const setDoneSchema = z.object({ id: z.string().min(1), done: z.boolean() });

export async function setRoomCalendarEventDone(input: z.input<typeof setDoneSchema>) {
  const session = await requireTasksRoomHubSession();
  const data = setDoneSchema.parse(input);
  const ev = await prisma.roomCalendarEvent.findUniqueOrThrow({
    where: { id: data.id },
    select: { viewId: true, doneAt: true },
  });
  const roomId = await ensureCalendarViewMember(ev.viewId, session.user.id);
  await prisma.roomCalendarEvent.update({
    where: { id: data.id },
    data: { doneAt: data.done ? (ev.doneAt ?? new Date()) : null },
  });
  revalidateView(roomId, ev.viewId);
}

export async function deleteRoomCalendarEvent(eventId: string) {
  const session = await requireTasksRoomHubSession();
  const ev = await prisma.roomCalendarEvent.findUniqueOrThrow({
    where: { id: eventId },
    select: { viewId: true },
  });
  const roomId = await ensureCalendarViewMember(ev.viewId, session.user.id);
  await prisma.roomCalendarEvent.delete({ where: { id: eventId } });
  revalidateView(roomId, ev.viewId);
}

// ───────────────────────── Campaign ─────────────────────────

const upsertCampaignSchema = z.object({
  id: z.string().optional(),
  viewId: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  startDate: dayKeySchema,
  endDate: dayKeySchema,
  color: z.enum(CAMPAIGN_COLOR_KEYS),
  status: z.nativeEnum(RoomCampaignStatus),
  objective: z.nativeEnum(ContentPlanUsage).optional().nullable(),
  channels: z.array(z.enum(CAMPAIGN_CHANNEL_KEYS)).max(CAMPAIGN_CHANNEL_KEYS.length),
  picUserIds: z.array(z.string().min(1)).max(20),
  budget: z.number().finite().min(0).max(999_999_999_999_999).optional().nullable(),
  kpiTarget: z.string().trim().max(500).optional().nullable(),
});

export async function upsertRoomCampaign(
  input: z.input<typeof upsertCampaignSchema>,
): Promise<{ id: string }> {
  const session = await requireTasksRoomHubSession();
  const data = upsertCampaignSchema.parse(input);
  const roomId = await ensureCalendarViewMember(data.viewId, session.user.id);

  if (data.endDate.getTime() < data.startDate.getTime()) {
    throw new Error("Tanggal selesai tidak boleh sebelum tanggal mulai.");
  }

  // PIC harus anggota ruangan; id lain dibuang diam-diam.
  const requested = [...new Set(data.picUserIds)];
  const members = requested.length
    ? await prisma.roomMember.findMany({
        where: { roomId, userId: { in: requested } },
        select: { userId: true },
      })
    : [];
  const memberIds = new Set(members.map((m) => m.userId));

  const fields = {
    name: data.name,
    description: data.description?.trim() || null,
    startDate: data.startDate,
    endDate: data.endDate,
    color: data.color,
    status: data.status,
    objective: data.objective ?? null,
    channels: [...new Set(data.channels)],
    picUserIds: requested.filter((id) => memberIds.has(id)),
    budget: data.budget ?? null,
    kpiTarget: data.kpiTarget?.trim() || null,
  };

  let id: string;
  if (data.id) {
    const existing = await prisma.roomCampaign.findFirst({
      where: { id: data.id, viewId: data.viewId },
      select: { id: true },
    });
    if (!existing) throw new Error("Campaign tidak ditemukan di kalender ini.");
    await prisma.roomCampaign.update({ where: { id: existing.id }, data: fields });
    id = existing.id;
  } else {
    const created = await prisma.roomCampaign.create({
      data: { ...fields, viewId: data.viewId, createdById: session.user.id },
      select: { id: true },
    });
    id = created.id;
  }
  revalidateView(roomId, data.viewId);
  return { id };
}

const rescheduleCampaignSchema = z.object({
  id: z.string().min(1),
  startDate: dayKeySchema,
  endDate: dayKeySchema,
});

/** Geser atau ubah panjang pita campaign (linimasa). */
export async function rescheduleRoomCampaign(
  input: z.input<typeof rescheduleCampaignSchema>,
) {
  const session = await requireTasksRoomHubSession();
  const data = rescheduleCampaignSchema.parse(input);
  const campaign = await prisma.roomCampaign.findUniqueOrThrow({
    where: { id: data.id },
    select: { viewId: true },
  });
  const roomId = await ensureCalendarViewMember(campaign.viewId, session.user.id);
  if (data.endDate.getTime() < data.startDate.getTime()) {
    throw new Error("Tanggal selesai tidak boleh sebelum tanggal mulai.");
  }
  await prisma.roomCampaign.update({
    where: { id: data.id },
    data: { startDate: data.startDate, endDate: data.endDate },
  });
  revalidateView(roomId, campaign.viewId);
}

/** Aktivitas campaign tidak ikut terhapus; relasinya dilepas (onDelete: SetNull). */
export async function deleteRoomCampaign(campaignId: string) {
  const session = await requireTasksRoomHubSession();
  const campaign = await prisma.roomCampaign.findUniqueOrThrow({
    where: { id: campaignId },
    select: { viewId: true },
  });
  const roomId = await ensureCalendarViewMember(campaign.viewId, session.user.id);
  await prisma.roomCampaign.delete({ where: { id: campaignId } });
  revalidateView(roomId, campaign.viewId);
}
