import { RoomTimelineStatus, type PrismaClient } from "@prisma/client";

/** Template milestone default untuk proyek pipeline baru (urutan alur bisnis). */
export const DEFAULT_PROJECT_MILESTONES: {
  title: string;
  description: string;
}[] = [
  {
    title: "Market Validation (BARU)",
    description:
      "Survey kebutuhan, preferensi, dan identifikasi pain point konsumen",
  },
  {
    title: "Idea Development",
    description:
      "Ide produk dikembangkan berbasis data aktual, bukan asumsi",
  },
  {
    title: "Competitor Analysis (BA)",
    description:
      "Identifikasi gap dan penentuan positioning yang kompetitif",
  },
  {
    title: "Target Market Definition",
    description:
      "Segmentasi konsumen berdasarkan data, bukan intuisi",
  },
  {
    title: "R&D Planning (DIPERBAIKI)",
    description:
      "Define scope, deliverable, dan SLA yang disepakati bersama vendor",
  },
  {
    title: "Product & Packaging Design",
    description:
      "Desain produk dan kemasan dijalankan secara paralel untuk efisiensi waktu",
  },
  {
    title: "Integrated Testing (DIPERBAIKI)",
    description:
      "Pengujian komprehensif: produk + kemasan + branding dengan kuesioner yang lebih lengkap",
  },
  {
    title: "Validation & Decision",
    description:
      "Keputusan Go / No-Go berdasarkan data dan threshold yang telah ditetapkan",
  },
  {
    title: "Production (Maklon)",
    description:
      "Produksi skala penuh dengan landasan validasi yang kuat",
  },
];

export type MilestoneProgressInput = { status: RoomTimelineStatus }[];

/** Persentase milestone berstatus Selesai (0–100). */
export function computeMilestoneProgress(
  milestones: MilestoneProgressInput,
): number {
  if (milestones.length === 0) return 0;
  const done = milestones.filter(
    (m) => m.status === RoomTimelineStatus.DONE,
  ).length;
  return Math.round((done / milestones.length) * 100);
}

export async function seedDefaultProjectMilestones(
  db: Pick<PrismaClient, "projectMilestone">,
  projectId: string,
): Promise<void> {
  const existing = await db.projectMilestone.count({ where: { projectId } });
  if (existing > 0) return;

  await db.projectMilestone.createMany({
    data: DEFAULT_PROJECT_MILESTONES.map((m, i) => ({
      projectId,
      title: m.title,
      description: m.description,
      status: RoomTimelineStatus.UPCOMING,
      sortOrder: i,
    })),
  });
}
