"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Moon, Sun } from "lucide-react";
import { setLabMode, useLabMode } from "@/lib/lab-theme";
import { cn } from "@/lib/utils";

/** Toggle mode terang/gelap khusus Dominatus Lab (terpisah dari tema DCC). */
export function LabThemeToggle({ className }: { className?: string }) {
  const mode = useLabMode();
  const reduce = useReducedMotion();

  return (
    <button
      type="button"
      onClick={() => setLabMode(mode === "dark" ? "light" : "dark")}
      aria-label="Ganti mode terang/gelap Dominatus Lab"
      title={mode === "dark" ? "Mode gelap Lab" : "Mode terang Lab"}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-full border border-border bg-card/60 text-muted-foreground backdrop-blur-md transition-colors hover:border-primary/40 hover:text-foreground",
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={mode}
          initial={reduce ? false : { opacity: 0, rotate: -90, scale: 0.6 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={reduce ? undefined : { opacity: 0, rotate: 90, scale: 0.6 }}
          transition={{ duration: 0.25 }}
          className="inline-flex"
        >
          {mode === "dark" ? (
            <Moon className="size-4" />
          ) : (
            <Sun className="size-4" />
          )}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
