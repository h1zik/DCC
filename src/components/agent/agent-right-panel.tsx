"use client";

import { useSession } from "next-auth/react";
import { Bot, PanelRightClose, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { canUseAgent } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { AgentChat } from "./agent-chat";
import { useAgentPanel } from "./agent-panel-context";

export function AgentRightPanel() {
  const { open, setOpen } = useAgentPanel();
  const { data: session } = useSession();
  const role = session?.user?.role;

  if (!canUseAgent(role)) return null;

  const displayName =
    session?.user?.name?.trim() ||
    session?.user?.email?.split("@")[0] ||
    "";

  return (
    <>
      <button
        type="button"
        aria-label="Tutup AI Agent"
        onClick={() => setOpen(false)}
        className={cn(
          "fixed inset-0 top-14 z-30 bg-black/15 backdrop-blur-[1px] transition-opacity duration-300 ease-out motion-reduce:transition-none",
          open
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
      />

      <aside
        aria-label="AI Agent"
        aria-hidden={!open}
        className={cn(
          "border-border/60 bg-background/95 fixed top-14 right-0 z-40 flex h-[calc(100dvh-3.5rem)] w-full max-w-[400px] flex-col border-l shadow-[-12px_0_40px_-20px_rgba(0,0,0,0.18)] backdrop-blur-xl",
          "transition-[transform,opacity] duration-[350ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
          open ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-full opacity-0",
        )}
      >
        <div
          className="from-primary/8 pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b to-transparent"
          aria-hidden
        />

        <header className="border-border/50 relative flex shrink-0 items-center gap-3 border-b px-4 py-3.5">
          <span className="bg-primary/10 text-primary ring-primary/20 flex size-9 shrink-0 items-center justify-center rounded-xl ring-1">
            <Bot className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-semibold tracking-tight">AI Agent</h2>
              <Sparkles className="text-primary/50 size-3.5" aria-hidden />
            </div>
            <p className="text-muted-foreground truncate text-[11px]">
              Kanban · KPI · Tugas otomatis
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground shrink-0 rounded-lg transition-colors duration-200"
            onClick={() => setOpen(false)}
            aria-label="Tutup panel agent"
          >
            <X className="size-4" />
          </Button>
        </header>

        <AgentChat userName={displayName} className="min-h-0 flex-1" />
      </aside>
    </>
  );
}

export function AgentPanelToggle({ className }: { className?: string }) {
  const { open, toggle } = useAgentPanel();
  const { data: session } = useSession();
  const role = session?.user?.role;

  if (!canUseAgent(role)) return null;

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      onClick={toggle}
      data-active={open ? "true" : "false"}
      aria-label={open ? "Tutup AI Agent" : "Buka AI Agent"}
      aria-expanded={open}
      title="AI Agent"
      className={cn(
        "relative shrink-0 overflow-hidden transition-[border-color,background-color,box-shadow,transform] duration-200 ease-out",
        "hover:border-primary/30 hover:bg-primary/5 active:scale-[0.96]",
        open && "border-primary/35 bg-primary/10 text-primary shadow-sm",
        className,
      )}
    >
      <Sparkles
        className={cn(
          "size-4 transition-transform duration-300 ease-out",
          open && "scale-110",
        )}
        aria-hidden
      />
      <PanelRightClose
        className={cn(
          "absolute size-3.5 opacity-0 transition-opacity duration-200",
          open && "opacity-40",
        )}
        aria-hidden
      />
    </Button>
  );
}
