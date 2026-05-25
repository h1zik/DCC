import { RoomTimelineStatus, type PrismaClient } from "@prisma/client";

/** Template milestone utama (11 tahap) untuk proyek pipeline baru. */
export const DEFAULT_PROJECT_MILESTONES: {
  title: string;
  description: string;
}[] = [
  {
    title: "Idea Development & Market Scouting",
    description: "Eksplorasi ide produk dan scouting pasar awal",
  },
  {
    title: "Target Market & Competitor Analysis",
    description: "Definisi segmen target dan analisis pesaing",
  },
  {
    title: "Market Validation (Concept Testing)",
    description: "Uji konsep ke konsumen / panel kecil",
  },
  {
    title: "R&D (Formulation & Sampling)",
    description: "Pengembangan formula dan sampling produk",
  },
  {
    title: "Product & Packaging Design",
    description: "Desain produk dan kemasan",
  },
  {
    title: "Integrated Testing (Panel Test)",
    description: "Pengujian terintegrasi dengan panel",
  },
  {
    title: "Final Validation & Decision",
    description: "Validasi akhir dan keputusan Go / No-Go",
  },
  {
    title: "Regulatory Compliance",
    description: "Kepatuhan regulasi dan legalitas produk",
  },
  {
    title: "Mass Production (+ Content Production)",
    description: "Produksi massal dan konten pendukung peluncuran",
  },
  {
    title: "Pre Launch",
    description: "Persiapan pra-peluncuran (distribusi, materi, dll.)",
  },
  {
    title: "Launch",
    description: "Peluncuran produk ke pasar",
  },
];

export type ProjectMilestoneFlat = {
  id: string;
  parentId: string | null;
  title: string;
  description: string | null;
  status: RoomTimelineStatus;
  sortOrder: number;
};

export type ProjectMilestoneNode = ProjectMilestoneFlat & {
  children: ProjectMilestoneNode[];
};

export type MilestoneProgressInput = {
  parentId?: string | null;
  status: RoomTimelineStatus;
};

/** Hanya milestone utama (tanpa parent) yang dihitung untuk progress %. */
export function topLevelMilestones<T extends { parentId?: string | null }>(
  milestones: T[],
): T[] {
  return milestones.filter((m) => !m.parentId);
}

export function buildMilestoneTree(
  flat: ProjectMilestoneFlat[],
): ProjectMilestoneNode[] {
  const byParent = new Map<string | null, ProjectMilestoneFlat[]>();
  for (const m of flat) {
    const key = m.parentId ?? null;
    const list = byParent.get(key) ?? [];
    list.push(m);
    byParent.set(key, list);
  }
  const sort = (a: ProjectMilestoneFlat, b: ProjectMilestoneFlat) =>
    a.sortOrder - b.sortOrder;

  function attach(node: ProjectMilestoneFlat): ProjectMilestoneNode {
    const kids = (byParent.get(node.id) ?? []).sort(sort).map(attach);
    return { ...node, children: kids };
  }

  return (byParent.get(null) ?? []).sort(sort).map(attach);
}

export function flattenMilestoneTree(
  nodes: ProjectMilestoneNode[],
): ProjectMilestoneFlat[] {
  const out: ProjectMilestoneFlat[] = [];
  function walk(list: ProjectMilestoneNode[]) {
    for (const n of list) {
      const { children, ...flat } = n;
      out.push(flat);
      if (children.length > 0) walk(children);
    }
  }
  walk(nodes);
  return out;
}

/** Persentase milestone utama berstatus Selesai (0–100). */
export function computeMilestoneProgress(
  milestones: MilestoneProgressInput[],
): number {
  const roots = topLevelMilestones(milestones);
  if (roots.length === 0) return 0;
  const done = roots.filter((m) => m.status === RoomTimelineStatus.DONE).length;
  return Math.round((done / roots.length) * 100);
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
      parentId: null,
      title: m.title,
      description: m.description,
      status: RoomTimelineStatus.UPCOMING,
      sortOrder: i,
    })),
  });
}

/** Hapus semua milestone proyek lalu terapkan template 11 tahap utama. */
export async function replaceProjectMilestonesWithDefaults(
  db: Pick<PrismaClient, "projectMilestone">,
  projectId: string,
): Promise<void> {
  await db.projectMilestone.deleteMany({ where: { projectId } });
  await seedDefaultProjectMilestones(db, projectId);
}
