"use client";

import { useEffect } from "react";
import { Sparkles, Wrench, Bug, Megaphone } from "lucide-react";
import {
  CHANGELOG_ENTRIES,
  type ChangelogCategory,
  type ChangelogEntry,
} from "@/lib/changelog/entries";
import { markChangelogSeen } from "@/lib/changelog/use-unseen";
import { cn } from "@/lib/utils";

const CATEGORY_META: Record<
  ChangelogCategory,
  { label: string; icon: typeof Sparkles; className: string }
> = {
  new: {
    label: "Baru",
    icon: Sparkles,
    className:
      "border-primary/25 bg-primary/10 text-primary",
  },
  improved: {
    label: "Peningkatan",
    icon: Wrench,
    className:
      "border-sky-500/25 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  },
  fixed: {
    label: "Perbaikan",
    icon: Bug,
    className:
      "border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
};

function formatDate(iso: string): string {
  // `iso` = "YYYY-MM-DD"; render lokal Indonesia tanpa bergantung timezone.
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const bulan = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];
  return `${d} ${bulan[m - 1]} ${y}`;
}

function CategoryBadge({ category }: { category: ChangelogCategory }) {
  const meta = CATEGORY_META[category];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        meta.className,
      )}
    >
      <Icon className="size-3" aria-hidden />
      {meta.label}
    </span>
  );
}

function EntryCard({ entry }: { entry: ChangelogEntry }) {
  return (
    <article className="bg-card relative rounded-xl border p-5">
      <div className="flex flex-wrap items-center gap-2">
        <CategoryBadge category={entry.category} />
        <time
          dateTime={entry.date}
          className="text-muted-foreground text-xs font-medium"
        >
          {formatDate(entry.date)}
        </time>
      </div>
      <h2 className="text-foreground mt-2.5 text-base font-semibold">
        {entry.title}
      </h2>
      <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
        {entry.description}
      </p>
      {entry.highlights && entry.highlights.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-1.5">
          {entry.highlights.map((h, i) => (
            <li
              key={i}
              className="text-foreground/80 flex items-start gap-2 text-sm"
            >
              <span
                className="bg-primary mt-1.5 size-1.5 shrink-0 rounded-full"
                aria-hidden
              />
              <span className="min-w-0">{h}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

export function ChangelogClient() {
  // Tandai semua entry sudah dilihat begitu halaman dibuka → badge unseen hilang.
  useEffect(() => {
    markChangelogSeen();
  }, []);

  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2.5">
          <span className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-xl border border-primary/25">
            <Megaphone className="size-5" aria-hidden />
          </span>
          <div>
            <h1 className="text-foreground text-xl font-semibold tracking-tight">
              Apa yang Baru
            </h1>
            <p className="text-muted-foreground text-sm">
              Riwayat fitur & perbaikan terbaru di Dominatus Control Center.
            </p>
          </div>
        </div>
      </header>

      {CHANGELOG_ENTRIES.length === 0 ? (
        <div className="text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
          Belum ada catatan perubahan.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {CHANGELOG_ENTRIES.map((entry) => (
            <EntryCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
