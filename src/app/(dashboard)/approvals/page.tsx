import type { PipelineStage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureCeoApprovalsAccess } from "@/lib/ensure-ceo-approvals";
import { taskProjectContextLabel } from "@/lib/room-simple-hub";
import { ApprovalsClient } from "./approvals-client";

type PipelineApprovalRow = {
  id: string;
  name: string;
  currentStage: PipelineStage;
  pendingPipelineStage: PipelineStage;
  brand: { name: string };
  room: { name: string };
};

export default async function ApprovalsPage() {
  await ensureCeoApprovalsAccess();

  const tasksRaw = await prisma.task.findMany({
    where: { isApprovalRequired: true, isApproved: false },
    include: {
      project: { include: { brand: true, room: { select: { name: true } } } },
      assignee: { select: { name: true, email: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  const tasks = tasksRaw.map((t) => ({
    ...t,
    contextLabel: taskProjectContextLabel(t.project),
  }));

  const pipelineRequests = (await prisma.project.findMany({
    where: {
      pendingPipelineStage: { not: null },
      brandId: { not: null },
    } as never,
    include: {
      brand: true,
      room: { select: { name: true } },
    },
    orderBy: { updatedAt: "desc" },
  })) as unknown as PipelineApprovalRow[];

  const pipelineRows = pipelineRequests.map((p) => ({
    id: p.id,
    name: p.name,
    currentStage: p.currentStage,
    pendingPipelineStage: p.pendingPipelineStage,
    brand: { name: p.brand.name },
    room: { name: p.room.name },
  }));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Persetujuan CEO
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Pindah tahap pipeline proyek memerlukan persetujuan Anda sebelum tahap
          resmi berubah. Tugas tertentu (mis. final sample) juga muncul di sini
          bila meminta persetujuan.
        </p>
      </div>
      <ApprovalsClient
        tasks={tasks}
        pipelineRequests={pipelineRows}
      />
    </div>
  );
}
