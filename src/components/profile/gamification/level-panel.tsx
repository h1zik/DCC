"use client";

/**
 * Fokus utama profil: Level (count-up saat load), XP progress bar (spring), dan
 * badge streak absensi (pulse bila streak hidup). Semua warna dari token tema;
 * hormati `prefers-reduced-motion` (nilai final langsung, tanpa animasi).
 */
import { useEffect, useState } from "react";
import { Flame, Sparkles } from "lucide-react";
import { animate, motion, useReducedMotion } from "motion/react";

export function LevelPanel({
  level,
  xpTotal,
  into,
  span,
  ratio,
  streak,
  longestStreak,
  streakAlive,
}: {
  level: number;
  xpTotal: number;
  into: number;
  span: number;
  ratio: number;
  nextLevelXp: number;
  streak: number;
  longestStreak: number;
  streakAlive: boolean;
}) {
  const reduce = useReducedMotion();
  const [counted, setCounted] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const controls = animate(0, level, {
      duration: 1.1,
      ease: "easeOut",
      onUpdate: (v) => setCounted(Math.round(v)),
    });
    return () => controls.stop();
  }, [level, reduce]);

  const display = reduce ? level : counted;
  const pct = Math.min(1, Math.max(0, ratio)) * 100;
  const maxed = span === 0;

  return (
    <div className="border-border/70 relative overflow-hidden rounded-2xl border bg-card p-5 shadow-sm">
      <div
        className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full opacity-20 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--chart-1), transparent 70%)" }}
        aria-hidden
      />
      <div className="relative flex items-center gap-4">
        <div className="relative flex size-16 shrink-0 items-center justify-center">
          <div
            className="absolute inset-0 rounded-2xl border-2"
            style={{
              borderColor: "color-mix(in oklab, var(--chart-1) 60%, transparent)",
              background: "color-mix(in oklab, var(--chart-1) 12%, transparent)",
            }}
            aria-hidden
          />
          <span
            className="relative text-2xl font-bold tabular-nums"
            style={{ color: "var(--chart-1)" }}
          >
            {display}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Sparkles className="size-3.5" style={{ color: "var(--chart-1)" }} aria-hidden />
            <span className="text-foreground text-sm font-semibold">Level {level}</span>
          </div>
          <p className="text-muted-foreground text-xs tabular-nums">
            {maxed
              ? `${xpTotal.toLocaleString("id-ID")} XP · level maks`
              : `${into.toLocaleString("id-ID")} / ${span.toLocaleString("id-ID")} XP → Lv ${level + 1}`}
          </p>
          <div
            className="bg-muted mt-2 h-2.5 w-full overflow-hidden rounded-full"
            role="progressbar"
            aria-valuenow={Math.round(pct)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <motion.div
              className="h-full rounded-full"
              style={{
                background: "linear-gradient(90deg, var(--chart-3), var(--chart-1))",
              }}
              initial={{ width: reduce ? `${pct}%` : 0 }}
              animate={{ width: `${maxed ? 100 : pct}%` }}
              transition={
                reduce
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 55, damping: 18, delay: 0.25 }
              }
            />
          </div>
        </div>
      </div>

      <div className="relative mt-4 flex items-center gap-2 border-t border-border/60 pt-3">
        <motion.span
          className="inline-flex items-center justify-center rounded-full p-1.5"
          style={{
            background: streakAlive
              ? "color-mix(in oklab, var(--chart-1) 18%, transparent)"
              : "var(--muted)",
          }}
          animate={
            streakAlive && !reduce
              ? { scale: [1, 1.12, 1], opacity: [0.85, 1, 0.85] }
              : {}
          }
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          aria-hidden
        >
          <Flame
            className="size-4"
            style={{
              color: streakAlive ? "var(--chart-1)" : "var(--muted-foreground)",
            }}
          />
        </motion.span>
        <div className="min-w-0 text-xs">
          <span className="text-foreground font-semibold tabular-nums">
            {streak} hari
          </span>{" "}
          <span className="text-muted-foreground">
            streak {streakAlive ? "aktif" : "(dingin)"} · terpanjang {longestStreak}
          </span>
        </div>
      </div>
    </div>
  );
}
