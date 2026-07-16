"use client";

import { useEffect, useState } from "react";
import {
  Bug,
  CalendarDays,
  Check,
  ListFilter,
  Megaphone,
  Search,
  SearchX,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";
import {
  CHANGELOG_ENTRIES,
  type ChangelogCategory,
  type ChangelogEntry,
} from "@/lib/changelog/entries";
import { markChangelogSeen } from "@/lib/changelog/use-unseen";
import { cn } from "@/lib/utils";

const CATEGORY_META: Record<
  ChangelogCategory,
  {
    label: string;
    icon: typeof Sparkles;
    badgeClassName: string;
    accentClassName: string;
    iconClassName: string;
  }
> = {
  new: {
    label: "Fitur baru",
    icon: Sparkles,
    badgeClassName:
      "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300",
    accentClassName: "bg-violet-500",
    iconClassName:
      "bg-violet-500/10 text-violet-700 ring-violet-500/20 dark:text-violet-300",
  },
  improved: {
    label: "Peningkatan",
    icon: Wrench,
    badgeClassName:
      "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    accentClassName: "bg-sky-500",
    iconClassName:
      "bg-sky-500/10 text-sky-700 ring-sky-500/20 dark:text-sky-300",
  },
  fixed: {
    label: "Perbaikan",
    icon: Bug,
    badgeClassName:
      "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    accentClassName: "bg-amber-500",
    iconClassName:
      "bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:text-amber-300",
  },
};

const MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;

type CategoryFilter = "all" | ChangelogCategory;

function getDateParts(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);

  if (!year || !month || !day || !MONTHS[month - 1]) {
    return { day: iso, month: "", year: "" };
  }

  return {
    day: String(day).padStart(2, "0"),
    month: MONTHS[month - 1],
    year: String(year),
  };
}

function formatDate(iso: string): string {
  const { day, month, year } = getDateParts(iso);
  return month ? `${Number(day)} ${month} ${year}` : day;
}

function CategoryBadge({ category }: { category: ChangelogCategory }) {
  const meta = CATEGORY_META[category];
  const Icon = meta.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide",
        meta.badgeClassName,
      )}
    >
      <Icon className="size-3" aria-hidden />
      {meta.label}
    </span>
  );
}

function EntryCard({
  entry,
  isLatest,
}: {
  entry: ChangelogEntry;
  isLatest: boolean;
}) {
  const meta = CATEGORY_META[entry.category];
  const Icon = meta.icon;

  return (
    <article className="group bg-card relative overflow-hidden rounded-2xl border shadow-[0_1px_2px_rgb(0_0_0/0.03)] transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-[0_12px_32px_-18px_rgb(0_0_0/0.3)]">
      <span
        className={cn("absolute inset-y-0 left-0 w-1", meta.accentClassName)}
        aria-hidden
      />

      <div className="p-5 pl-6 sm:p-6 sm:pl-7">
        <div className="flex items-start gap-3.5 sm:gap-4">
          <span
            className={cn(
              "hidden size-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset sm:flex",
              meta.iconClassName,
            )}
          >
            <Icon className="size-[18px]" aria-hidden />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <CategoryBadge category={entry.category} />
              {isLatest ? (
                <span className="bg-primary text-primary-foreground inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide">
                  <span className="bg-primary-foreground size-1.5 rounded-full" aria-hidden />
                  Terbaru
                </span>
              ) : null}
            </div>

            <h2 className="text-foreground mt-3 text-base leading-snug font-semibold tracking-[-0.01em] text-balance sm:text-lg">
              {entry.title}
            </h2>
            <p className="text-muted-foreground mt-2 text-sm leading-6">
              {entry.description}
            </p>

            {entry.highlights?.length ? (
              <ul className="border-border/70 mt-4 grid gap-2 border-t pt-4 lg:grid-cols-2">
                {entry.highlights.map((highlight) => (
                  <li
                    key={highlight}
                    className="text-foreground/80 flex items-start gap-2.5 text-[13px] leading-5"
                  >
                    <span className="bg-muted text-foreground mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full">
                      <Check className="size-2.5" strokeWidth={2.5} aria-hidden />
                    </span>
                    <span className="min-w-0">{highlight}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

function EmptyResults({ onReset }: { onReset: () => void }) {
  return (
    <div className="bg-card flex flex-col items-center rounded-2xl border border-dashed px-6 py-14 text-center">
      <span className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-2xl">
        <SearchX className="size-5" aria-hidden />
      </span>
      <h2 className="text-foreground mt-4 font-semibold">
        Tidak ada pembaruan yang cocok
      </h2>
      <p className="text-muted-foreground mt-1.5 max-w-sm text-sm leading-6">
        Coba kata kunci lain atau tampilkan kembali semua kategori.
      </p>
      <button
        type="button"
        onClick={onReset}
        className="border-border bg-background text-foreground hover:bg-muted mt-5 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors"
      >
        Reset filter
      </button>
    </div>
  );
}

export function ChangelogClient() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");

  useEffect(() => {
    markChangelogSeen();
  }, []);

  const normalizedQuery = query.trim().toLocaleLowerCase("id-ID");
  const filteredEntries = CHANGELOG_ENTRIES.filter((entry) => {
    if (category !== "all" && entry.category !== category) return false;
    if (!normalizedQuery) return true;

    return [entry.title, entry.description, ...(entry.highlights ?? [])]
      .join(" ")
      .toLocaleLowerCase("id-ID")
      .includes(normalizedQuery);
  });

  const dateGroups = filteredEntries.reduce<
    Array<{ date: string; entries: ChangelogEntry[] }>
  >((groups, entry) => {
    const currentGroup = groups.at(-1);
    if (currentGroup?.date === entry.date) {
      currentGroup.entries.push(entry);
    } else {
      groups.push({ date: entry.date, entries: [entry] });
    }
    return groups;
  }, []);

  const categoryCounts = CHANGELOG_ENTRIES.reduce<Record<ChangelogCategory, number>>(
    (counts, entry) => {
      counts[entry.category] += 1;
      return counts;
    },
    { new: 0, improved: 0, fixed: 0 },
  );

  const latestEntry = CHANGELOG_ENTRIES[0];
  const latestDate = latestEntry ? getDateParts(latestEntry.date) : null;
  const hasActiveFilters = Boolean(query) || category !== "all";
  const resetFilters = () => {
    setQuery("");
    setCategory("all");
  };

  const filters: Array<{
    value: CategoryFilter;
    label: string;
    count: number;
  }> = [
    { value: "all", label: "Semua", count: CHANGELOG_ENTRIES.length },
    ...(["new", "improved", "fixed"] as const).map((value) => ({
      value,
      label: CATEGORY_META[value].label,
      count: categoryCounts[value],
    })),
  ];

  return (
    <main className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-6 pb-10">
      <section className="bg-card relative isolate overflow-hidden rounded-3xl border px-5 py-7 shadow-[0_16px_50px_-36px_rgb(0_0_0/0.35)] sm:px-8 sm:py-9 lg:px-10">
        <div
          className="bg-primary/8 absolute -top-20 -right-16 -z-10 size-72 rounded-full blur-3xl"
          aria-hidden
        />
        <div
          className="bg-accent/35 absolute -bottom-28 left-1/3 -z-10 size-64 rounded-full blur-3xl"
          aria-hidden
        />

        <div className="grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="max-w-2xl">
            <div className="text-primary flex items-center gap-2 text-xs font-semibold tracking-[0.16em] uppercase">
              <span className="bg-primary/10 flex size-8 items-center justify-center rounded-lg ring-1 ring-primary/15">
                <Megaphone className="size-4" aria-hidden />
              </span>
              Changelog DCC
            </div>
            <h1 className="text-foreground mt-5 text-3xl leading-tight font-semibold tracking-[-0.035em] text-balance sm:text-4xl">
              Apa yang baru di Dominatus Control Center
            </h1>
            <p className="text-muted-foreground mt-3 max-w-xl text-sm leading-6 sm:text-base sm:leading-7">
              Ikuti fitur baru, peningkatan alur kerja, dan perbaikan penting yang
              membuat pekerjaan tim lebih cepat dan lebih nyaman.
            </p>
          </div>

          {latestEntry && latestDate ? (
            <div className="border-border/70 bg-background/65 flex min-w-0 items-center gap-4 rounded-2xl border p-3 pr-5 backdrop-blur-sm sm:min-w-72">
              <time
                dateTime={latestEntry.date}
                aria-label={formatDate(latestEntry.date)}
                className="bg-primary text-primary-foreground flex size-16 shrink-0 flex-col items-center justify-center rounded-xl"
              >
                <span className="text-2xl leading-none font-semibold tabular-nums">
                  {latestDate.day}
                </span>
                <span className="mt-1 text-[9px] leading-none font-bold tracking-[0.14em] uppercase opacity-75">
                  {latestDate.month.slice(0, 3)}
                </span>
              </time>
              <div className="min-w-0">
                <p className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
                  Rilis terbaru
                </p>
                <p className="text-foreground mt-1 text-sm font-semibold">
                  {latestDate.month} {latestDate.year}
                </p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {CHANGELOG_ENTRIES.length} pembaruan tersedia
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {CHANGELOG_ENTRIES.length === 0 ? (
        <div className="text-muted-foreground bg-card rounded-2xl border border-dashed p-10 text-center text-sm">
          Belum ada catatan perubahan.
        </div>
      ) : (
        <>
          <section
            aria-label="Cari dan filter changelog"
            className="border-border/70 bg-background/90 z-10 rounded-2xl border p-3 shadow-[0_10px_30px_-24px_rgb(0_0_0/0.4)] backdrop-blur-xl sm:sticky sm:top-[4.5rem]"
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <label className="relative block min-w-0 flex-1">
                <span className="sr-only">Cari pembaruan</span>
                <Search
                  className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
                  aria-hidden
                />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Cari fitur, modul, atau perbaikan..."
                  className="border-input bg-card text-foreground placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-ring/20 h-10 w-full rounded-xl border pr-10 pl-10 text-sm outline-none transition-[border-color,box-shadow] focus-visible:ring-3"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label="Hapus pencarian"
                    className="text-muted-foreground hover:bg-muted hover:text-foreground absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-lg transition-colors"
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                ) : null}
              </label>

              <div className="flex min-w-0 items-center gap-2">
                <ListFilter
                  className="text-muted-foreground hidden size-4 shrink-0 sm:block"
                  aria-hidden
                />
                <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto rounded-xl bg-muted/70 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {filters.map((filter) => (
                    <button
                      key={filter.value}
                      type="button"
                      onClick={() => setCategory(filter.value)}
                      aria-pressed={category === filter.value}
                      className={cn(
                        "flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-[background-color,color,box-shadow]",
                        category === filter.value
                          ? "bg-card text-foreground shadow-sm ring-1 ring-border/60"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {filter.label}
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                          category === filter.value
                            ? "bg-primary/10 text-primary"
                            : "bg-background/60",
                        )}
                      >
                        {filter.count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <div className="flex items-center justify-between gap-4 px-1">
            <p className="text-muted-foreground text-sm" aria-live="polite">
              <span className="text-foreground font-semibold tabular-nums">
                {filteredEntries.length}
              </span>{" "}
              {hasActiveFilters ? "hasil ditemukan" : "pembaruan terbaru"}
            </p>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={resetFilters}
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs font-medium transition-colors"
              >
                <X className="size-3.5" aria-hidden />
                Reset filter
              </button>
            ) : null}
          </div>

          {dateGroups.length === 0 ? (
            <EmptyResults onReset={resetFilters} />
          ) : (
            <div className="flex flex-col gap-8">
              {dateGroups.map((group) => {
                const date = getDateParts(group.date);
                const headingId = `changelog-${group.date}`;

                return (
                  <section
                    key={group.date}
                    aria-labelledby={headingId}
                    className="relative grid gap-4 md:grid-cols-[8.5rem_minmax(0,1fr)] md:gap-6"
                  >
                    <div className="md:sticky md:top-40 md:self-start">
                      <time
                        dateTime={group.date}
                        id={headingId}
                        aria-label={formatDate(group.date)}
                        className="flex items-center gap-2.5 md:block"
                      >
                        <span className="border-border bg-card text-foreground flex size-10 shrink-0 items-center justify-center rounded-xl border text-sm font-semibold tabular-nums shadow-sm md:size-12 md:text-base">
                          {date.day}
                        </span>
                        <span className="min-w-0 md:mt-2 md:block">
                          <span className="text-foreground block text-sm font-semibold">
                            {date.month}
                          </span>
                          <span className="text-muted-foreground block text-xs">
                            {date.year} · {group.entries.length}{" "}
                            {group.entries.length === 1 ? "update" : "updates"}
                          </span>
                        </span>
                      </time>
                    </div>

                    <div className="relative flex min-w-0 flex-col gap-3.5 md:pl-6 before:absolute before:top-0 before:bottom-0 before:left-0 before:hidden before:w-px before:bg-border md:before:block">
                      <span
                        className="bg-primary ring-background absolute top-5 -left-1 hidden size-2 rounded-full ring-4 md:block"
                        aria-hidden
                      />
                      {group.entries.map((entry) => (
                        <EntryCard
                          key={entry.id}
                          entry={entry}
                          isLatest={entry.id === latestEntry?.id}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}

          {filteredEntries.length > 8 ? (
            <div className="border-border/70 text-muted-foreground flex items-center justify-center gap-2 border-t pt-6 text-xs">
              <CalendarDays className="size-3.5" aria-hidden />
              Semua pembaruan ditampilkan dari yang terbaru
            </div>
          ) : null}
        </>
      )}
    </main>
  );
}
