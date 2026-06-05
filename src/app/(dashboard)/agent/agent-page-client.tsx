"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAgentPanel } from "@/components/agent/agent-panel-context";

export function AgentPageClient() {
  const router = useRouter();
  const { setOpen } = useAgentPanel();

  useEffect(() => {
    setOpen(true);
    router.replace("/tasks");
  }, [router, setOpen]);

  return (
    <div className="text-muted-foreground flex min-h-[40vh] flex-col items-center justify-center gap-3 text-sm">
      <Loader2 className="size-5 animate-spin" aria-hidden />
      <p>Membuka AI Agent…</p>
    </div>
  );
}
