"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Loader2, Send, Sparkles, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AgentMessageContent } from "@/components/agent/agent-message-content";
import { cn } from "@/lib/utils";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  toolCalls?: { name: string; ok: boolean }[];
};

const SUGGESTIONS = [
  "Gimana kondisi workload saya hari ini?",
  "Analisis ruangan Room Archipelago",
  "Apa tugas saya yang deadline minggu ini?",
  "Ringkasan KPI dan yang perlu diprioritaskan",
] as const;

function TypingIndicator() {
  return (
    <div className="flex items-center gap-2.5 px-1 py-1">
      <span className="bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-full">
        <Bot className="size-3.5" aria-hidden />
      </span>
      <div className="border-border/70 bg-muted/40 flex items-center gap-1 rounded-2xl rounded-bl-md border px-3.5 py-2.5">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="bg-muted-foreground/35 size-1.5 rounded-full motion-safe:animate-bounce"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

export function AgentChat({
  userName,
  className,
}: {
  userName: string;
  className?: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: `Hai${userName ? ` ${userName}` : ""}! Saya asisten DCC — bisa bantu analisis workload, prioritas tugas, Kanban, sampai eksekusi langsung. Tanya "gimana kondisi ruangan X?" atau langsung minta buat/edit tugas.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);

  const scrollToBottom = (smooth = true) => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({
        behavior: smooth ? "smooth" : "auto",
        block: "end",
      });
    });
  };

  useEffect(() => {
    scrollToBottom(false);
  }, []);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const updateInset = () => {
      const inset = Math.max(
        0,
        window.innerHeight - viewport.height - viewport.offsetTop,
      );
      setKeyboardInset(inset);
      if (inset > 0) scrollToBottom(false);
    };

    viewport.addEventListener("resize", updateInset);
    viewport.addEventListener("scroll", updateInset);
    updateInset();

    return () => {
      viewport.removeEventListener("resize", updateInset);
      viewport.removeEventListener("scroll", updateInset);
    };
  }, []);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setError(null);
    const userMsg: ChatMessage = { role: "user", content: trimmed };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    scrollToBottom();

    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = (await res.json()) as {
        ok?: boolean;
        reply?: string;
        toolCalls?: { name: string; ok: boolean }[];
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error ?? "Gagal menghubungi AI Agent.");
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply ?? "Selesai.",
          toolCalls: data.toolCalls,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  };

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4"
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "flex gap-2.5 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-300",
              msg.role === "user" ? "flex-row-reverse" : "flex-row",
            )}
            style={{ animationDelay: `${Math.min(i * 40, 120)}ms` }}
          >
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full",
                msg.role === "user"
                  ? "bg-primary/12 text-primary"
                  : "bg-muted text-muted-foreground",
              )}
              aria-hidden
            >
              {msg.role === "user" ? (
                <User className="size-3.5" />
              ) : (
                <Bot className="size-3.5" />
              )}
            </span>
            <div
              className={cn(
                "max-w-[88%] space-y-1.5 text-[13px] leading-relaxed",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-3.5 py-2.5 shadow-sm"
                  : "border-border/60 bg-muted/30 text-foreground rounded-2xl rounded-bl-sm border px-3.5 py-2.5",
              )}
            >
              {msg.role === "assistant" ? (
                <AgentMessageContent content={msg.content} />
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
              {msg.toolCalls && msg.toolCalls.length > 0 ? (
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {msg.toolCalls.map((tc, j) => (
                    <span
                      key={j}
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase",
                        tc.ok
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                          : "bg-destructive/10 text-destructive",
                      )}
                    >
                      {tc.name.replaceAll("_", " ")}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ))}

        {loading ? <TypingIndicator /> : null}

        {error ? (
          <p
            className="text-destructive motion-safe:animate-in motion-safe:fade-in-0 px-1 text-xs"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <div ref={bottomRef} className="h-px shrink-0" />
      </div>

      {messages.length <= 1 ? (
        <div className="border-border/50 flex shrink-0 flex-wrap gap-1.5 border-t px-4 py-3">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => void sendMessage(s)}
              className="border-border/70 bg-background/80 text-muted-foreground hover:border-primary/25 hover:bg-primary/5 hover:text-foreground min-h-9 rounded-full border px-3 py-2 text-xs transition-[colors,transform] duration-200 ease-out hover:scale-[1.02] active:scale-[0.98]"
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}

      <form
        className="border-border/60 bg-background/80 shrink-0 border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm"
        style={
          keyboardInset > 0
            ? { paddingBottom: `${keyboardInset + 12}px` }
            : undefined
        }
        onSubmit={(e) => {
          e.preventDefault();
          void sendMessage(input);
        }}
      >
        <div className="border-border/70 bg-background focus-within:border-primary/35 focus-within:ring-primary/15 flex items-end gap-2 rounded-xl border p-1.5 shadow-sm transition-[border-color,box-shadow] duration-200 focus-within:ring-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Buat tugas, cek KPI, pindah status Kanban…"
            rows={1}
            className="max-h-28 min-h-[36px] resize-none border-0 bg-transparent px-2 py-1.5 text-[13px] shadow-none focus-visible:ring-0"
            disabled={loading}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendMessage(input);
              }
            }}
          />
          <Button
            type="submit"
            size="icon-sm"
            className="mb-0.5 shrink-0 rounded-lg transition-transform duration-200 active:scale-95"
            disabled={loading || !input.trim()}
            aria-label="Kirim pesan"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </div>
        <p className="text-muted-foreground/70 mt-2 flex items-center justify-center gap-1 text-[10px]">
          <Sparkles className="size-3" aria-hidden />
          Groq · Enter kirim · Shift+Enter baris baru
        </p>
      </form>
    </div>
  );
}
