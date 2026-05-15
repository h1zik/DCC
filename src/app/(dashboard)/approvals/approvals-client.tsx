"use client";
import { actionErrorMessage } from "@/lib/action-error-message";

import type { PipelineStage } from "@prisma/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ceoApproveTask } from "@/actions/approvals";
import {
  approveProjectPipelineStage,
  rejectProjectPipelineStage,
} from "@/actions/projects";
import { PIPELINE_LABELS } from "@/lib/pipeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  project: { name: string; brand: { name: string } | null };
  assignees: { user: { name: string | null; email: string } }[];
  contextLabel: string;
};

type PipelineRow = {
  id: string;
  name: string;
  currentStage: PipelineStage;
  pendingPipelineStage: PipelineStage;
  brand: { name: string };
  room: { name: string };
};

export function ApprovalsClient({
  tasks,
  pipelineRequests,
}: {
  tasks: TaskRow[];
  pipelineRequests: PipelineRow[];
}) {
  const router = useRouter();

  async function approveTask(id: string) {
    try {
      await ceoApproveTask(id);
      toast.success("Tugas disetujui.");
      router.refresh();
    } catch (e) {
      toast.error(actionErrorMessage(e, "Gagal menyetujui."));
    }
  }

  async function approvePipeline(projectId: string) {
    try {
      await approveProjectPipelineStage(projectId);
      toast.success("Pindah tahap pipeline disetujui.");
      router.refresh();
    } catch (e) {
      toast.error(actionErrorMessage(e, "Gagal menyetujui."));
    }
  }

  async function rejectPipeline(projectId: string) {
    if (!confirm("Tolak pengajuan pindah tahap? Proyek tetap di tahap saat ini.")) {
      return;
    }
    try {
      await rejectProjectPipelineStage(projectId);
      toast.success("Pengajuan ditolak.");
      router.refresh();
    } catch (e) {
      toast.error(actionErrorMessage(e, "Gagal menolak."));
    }
  }

  if (tasks.length === 0 && pipelineRequests.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Tidak ada permintaan persetujuan yang tertunda.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {pipelineRequests.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">
            Pipeline proyek
          </h2>
          <ul className="flex flex-col gap-4">
            {pipelineRequests.map((p) => (
              <li key={p.id}>
                <Card>
                  <CardHeader>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <CardTitle className="text-base">{p.name}</CardTitle>
                      <Badge variant="secondary">Menunggu CEO</Badge>
                    </div>
                    <CardDescription>
                      {p.brand.name} · {p.room.name}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm">
                    <p>
                      <span className="text-muted-foreground">Tahap saat ini: </span>
                      <span className="font-medium">
                        {PIPELINE_LABELS[p.currentStage]}
                      </span>
                    </p>
                    <p className="mt-1">
                      <span className="text-muted-foreground">Diajukan pindah ke: </span>
                      <span className="font-medium">
                        {PIPELINE_LABELS[p.pendingPipelineStage]}
                      </span>
                    </p>
                  </CardContent>
                  <CardFooter className="flex flex-wrap gap-2">
                    <Button onClick={() => void approvePipeline(p.id)}>
                      Setujui pindah tahap
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => void rejectPipeline(p.id)}
                    >
                      Tolak
                    </Button>
                  </CardFooter>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tasks.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">Tugas</h2>
          <ul className="flex flex-col gap-4">
            {tasks.map((t) => (
              <li key={t.id}>
                <Card>
                  <CardHeader>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <CardTitle className="text-base">{t.title}</CardTitle>
                      <Badge variant="secondary">Menunggu CEO</Badge>
                    </div>
                    <CardDescription>
                      {t.contextLabel} · {t.project.name}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {t.description ? (
                      <p className="text-muted-foreground">{t.description}</p>
                    ) : null}
                    <p className="text-muted-foreground text-xs">
                      PIC:{" "}
                      {t.assignees.length > 0
                        ? t.assignees
                            .map((a) => a.user.name ?? a.user.email)
                            .join(", ")
                        : "Belum ditetapkan"}
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Button onClick={() => void approveTask(t.id)}>
                      Setujui (CEO)
                    </Button>
                  </CardFooter>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
