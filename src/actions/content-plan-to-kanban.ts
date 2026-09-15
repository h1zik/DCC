"use server";

import { revalidatePath } from "next/cache";
import {
  ContentPlanStatusKerja,
  ContentPlanTaskKind,
  RoomTaskProcess,
  TaskPriority,
  TaskStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireTasksRoomHubSession } from "@/lib/auth-helpers";
import { assertRoomMember } from "@/lib/room-access";
import { isSimpleHubRoom } from "@/lib/room-simple-hub";
import { createTask } from "@/actions/tasks";
import {
  contentPlanTaskKindLabel,
  contentPlanTaskKindOrDefault,
} from "@/lib/content-plan-task-kind";
import {
  JENIS_LABEL,
  PLATFORM_LABEL,
  USAGE_LABEL,
  sortPlatforms,
} from "@/lib/content-plan-ui";

const KIND_ORDER: ContentPlanTaskKind[] = [
  ContentPlanTaskKind.COPYWRITING,
  ContentPlanTaskKind.DESIGN,
];

type PlanRow = {
  id: string;
  konten: string;
  jenisKonten: keyof typeof JENIS_LABEL;
  usage: keyof typeof USAGE_LABEL;
  platforms: (keyof typeof PLATFORM_LABEL)[];
  detailKonten: string | null;
  copywritingLink: string | null;
  designLink: string | null;
  picUserIds: string[];
  picUserId: string | null;
  deadlineCopywriting: Date | null;
  deadlineDesign: Date | null;
  tanggalPosting: Date | null;
  jamPosting: string | null;
  statusCopywriting: ContentPlanStatusKerja;
  statusDesign: ContentPlanStatusKerja;
};

function formatDateId(d: Date | null): string | null {
  if (!d) return null;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(d);
}

function buildTaskTitle(kind: ContentPlanTaskKind, konten: string): string {
  const base = konten.trim() || "Konten";
  return `[${contentPlanTaskKindLabel(kind)}] ${base}`;
}

/**
 * Deskripsi tugas berisi konteks yang dibutuhkan pengerja (jenis, platform,
 * jadwal tayang, tautan referensi) plus tautan balik ke halaman Content Planning.
 */
function buildTaskDescription(params: {
  kind: ContentPlanTaskKind;
  roomId: string;
  row: PlanRow;
}): string {
  const { kind, roomId, row } = params;
  const platforms = sortPlatforms(row.platforms).map((p) => PLATFORM_LABEL[p]);
  const posting = formatDateId(row.tanggalPosting);
  const postingLabel = posting
    ? `${posting}${row.jamPosting ? ` ${row.jamPosting} WIB` : ""}`
    : null;

  const facts = [
    `Jenis: ${JENIS_LABEL[row.jenisKonten]}`,
    `Tujuan: ${USAGE_LABEL[row.usage]}`,
    platforms.length ? `Platform: ${platforms.join(", ")}` : null,
    postingLabel ? `Rencana tayang: ${postingLabel}` : null,
  ].filter(Boolean);

  const links =
    kind === ContentPlanTaskKind.DESIGN
      ? [
          row.copywritingLink?.trim()
            ? `Link copywriting (acuan): ${row.copywritingLink.trim()}`
            : null,
          row.designLink?.trim() ? `Link design: ${row.designLink.trim()}` : null,
        ]
      : [
          row.copywritingLink?.trim()
            ? `Link copywriting: ${row.copywritingLink.trim()}`
            : null,
        ];

  const sections = [
    `Tugas ${contentPlanTaskKindLabel(kind).toLowerCase()} dari Content Planning.`,
    facts.join("\n"),
    row.detailKonten?.trim() ? `Detail konten:\n${row.detailKonten.trim()}` : null,
    links.filter(Boolean).join("\n") || null,
    `Halaman Content Planning: /room/${roomId}/content-planning`,
  ].filter(Boolean);

  return sections.join("\n\n");
}

function rowStatusForKind(row: PlanRow, kind: ContentPlanTaskKind) {
  return kind === ContentPlanTaskKind.COPYWRITING
    ? row.statusCopywriting
    : row.statusDesign;
}

function rowDeadlineForKind(row: PlanRow, kind: ContentPlanTaskKind) {
  return kind === ContentPlanTaskKind.COPYWRITING
    ? row.deadlineCopywriting
    : row.deadlineDesign;
}

export type CreateKanbanTasksFromContentPlanResult = {
  /** Jumlah tugas yang berhasil dibuat (baris × jenis). */
  created: number;
  /** Dilewati karena status bukan Baru atau sudah punya tugas jenis tersebut. */
  skipped: number;
  /** Gagal dibuat (mis. PIC tidak punya akses fase). Pesan per kegagalan. */
  failed: { title: string; reason: string }[];
};

/**
 * Buat tugas Kanban dari baris Content Planning yang dipilih (`itemIds`).
 * Setiap baris bisa menghasilkan tugas **Copy** dan/atau **Design** sesuai
 * `kinds`. Per jenis, hanya baris dengan status jenis itu = **Baru** dan yang
 * belum punya tugas aktif jenis itu yang diproses; sisanya dihitung dilewati.
 *
 * Setelah tugas berhasil dibuat, status jenis itu pada baris diubah ke
 * Dalam Proses. Kegagalan satu baris tidak menghentikan baris lain.
 */
export async function createKanbanTasksFromContentPlan(params: {
  roomId: string;
  projectId: string;
  itemIds: string[];
  kinds: ContentPlanTaskKind[];
}): Promise<CreateKanbanTasksFromContentPlanResult> {
  const session = await requireTasksRoomHubSession();
  await assertRoomMember(params.roomId, session.user.id);

  const requested = [...new Set(params.itemIds.map((id) => id.trim()).filter(Boolean))];
  if (requested.length === 0) {
    throw new Error("Pilih minimal satu baris content planning.");
  }
  const kinds = KIND_ORDER.filter((k) => params.kinds.includes(k));
  if (kinds.length === 0) {
    throw new Error("Pilih jenis tugas yang ingin dibuat (Copy dan/atau Design).");
  }

  const project = await prisma.project.findFirst({
    where: { id: params.projectId, roomId: params.roomId },
    select: { id: true },
  });
  if (!project) {
    throw new Error("Proyek tidak ditemukan di ruangan ini.");
  }

  const simpleHub = await isSimpleHubRoom(params.roomId);
  const roomProcess = simpleHub
    ? RoomTaskProcess.MARKET_RESEARCH
    : RoomTaskProcess.BRAND_AND_DESIGN;

  const [rows, existingTasks] = await Promise.all([
    prisma.roomContentPlanItem.findMany({
      where: { roomId: params.roomId, id: { in: requested }, archivedAt: null },
      select: {
        id: true,
        konten: true,
        jenisKonten: true,
        usage: true,
        platforms: true,
        detailKonten: true,
        copywritingLink: true,
        designLink: true,
        picUserIds: true,
        picUserId: true,
        deadlineCopywriting: true,
        deadlineDesign: true,
        tanggalPosting: true,
        jamPosting: true,
        statusCopywriting: true,
        statusDesign: true,
      },
    }),
    prisma.task.findMany({
      where: { contentPlanItemId: { in: requested }, archivedAt: null },
      select: { contentPlanItemId: true, contentPlanKind: true },
    }),
  ]);

  const byId = new Map<string, PlanRow>(rows.map((r) => [r.id, r]));
  const existingKinds = new Set(
    existingTasks.map(
      (t) => `${t.contentPlanItemId}:${contentPlanTaskKindOrDefault(t.contentPlanKind)}`,
    ),
  );

  const result: CreateKanbanTasksFromContentPlanResult = {
    created: 0,
    skipped: 0,
    failed: [],
  };

  for (const id of requested) {
    const row = byId.get(id);
    if (!row) {
      result.skipped += kinds.length;
      continue;
    }

    const picIds = row.picUserIds?.length
      ? row.picUserIds
      : row.picUserId
        ? [row.picUserId]
        : [];

    for (const kind of kinds) {
      if (
        rowStatusForKind(row, kind) !== ContentPlanStatusKerja.BARU ||
        existingKinds.has(`${row.id}:${kind}`)
      ) {
        result.skipped += 1;
        continue;
      }

      const title = buildTaskTitle(kind, row.konten);
      try {
        await createTask({
          projectId: params.projectId,
          title,
          description: buildTaskDescription({ kind, roomId: params.roomId, row }),
          assigneeIds: picIds,
          priority: TaskPriority.MEDIUM,
          status: TaskStatus.TODO,
          dueDate: rowDeadlineForKind(row, kind),
          isApprovalRequired: false,
          roomProcess,
          contentPlanItemId: row.id,
          contentPlanJenis: row.jenisKonten,
          contentPlanKind: kind,
        });
        await prisma.roomContentPlanItem.update({
          where: { id: row.id },
          data:
            kind === ContentPlanTaskKind.COPYWRITING
              ? { statusCopywriting: ContentPlanStatusKerja.DALAM_PROSES }
              : { statusDesign: ContentPlanStatusKerja.DALAM_PROSES },
        });
        existingKinds.add(`${row.id}:${kind}`);
        result.created += 1;
      } catch (e) {
        result.failed.push({
          title,
          reason: e instanceof Error ? e.message : "Gagal membuat tugas.",
        });
      }
    }
  }

  revalidatePath(`/room/${params.roomId}/content-planning`);
  return result;
}
