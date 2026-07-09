"use client";

/**
 * Kerangka Edit Profil: navigasi vertikal (desktop) / segmented (mobile),
 * satu bagian aktif, deep-link hash, fokus keyboard.
 */
import { useEffect, useState, type ReactNode } from "react";
import {
  ChevronRight,
  Monitor,
  Palette,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

type SectionId = "profil" | "kustomisasi" | "akun" | "aplikasi";

const SECTIONS: {
  id: SectionId;
  label: string;
  hint: string;
  Icon: typeof User;
}[] = [
  {
    id: "profil",
    label: "Profil",
    hint: "Foto, nama, bio publik",
    Icon: User,
  },
  {
    id: "kustomisasi",
    label: "Kustomisasi",
    hint: "Latar, frame, showcase",
    Icon: Sparkles,
  },
  {
    id: "akun",
    label: "Akun",
    hint: "Kontak & keamanan",
    Icon: ShieldCheck,
  },
  {
    id: "aplikasi",
    label: "Tampilan app",
    hint: "Tema warna aplikasi",
    Icon: Palette,
  },
];

const SECTION_COPY: Record<
  SectionId,
  { title: string; description: string }
> = {
  profil: {
    title: "Profil publik",
    description:
      "Identitas yang orang lain lihat di Kanban, chat, dan halaman profilmu.",
  },
  kustomisasi: {
    title: "Kustomisasi tampilan",
    description:
      "Atur latar, frame avatar, nameplate, dan showcase — seperti profil Steam.",
  },
  akun: {
    title: "Akun & keamanan",
    description:
      "Kontak notifikasi dan kredensial masuk. Terpisah dari identitas publik.",
  },
  aplikasi: {
    title: "Tampilan aplikasi",
    description:
      "Tema warna seluruh DCC — hanya berlaku untuk perangkatmu.",
  },
};

function isSectionId(v: string): v is SectionId {
  return SECTIONS.some((s) => s.id === v);
}

export function EditProfileShell({
  profil,
  kustomisasi,
  akun,
  aplikasi,
}: {
  profil: ReactNode;
  kustomisasi: ReactNode;
  akun: ReactNode;
  aplikasi: ReactNode;
}) {
  const [active, setActive] = useState<SectionId>("profil");

  useEffect(() => {
    const h = window.location.hash.replace("#", "");
    const target: SectionId | null =
      h === "achievements" ? "kustomisasi" : isSectionId(h) ? h : null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hash sync post-hydration
    if (target) setActive(target);
  }, []);

  const content: Record<SectionId, ReactNode> = {
    profil,
    kustomisasi,
    akun,
    aplikasi,
  };
  const meta = SECTION_COPY[active];

  function selectSection(id: SectionId) {
    setActive(id);
    if (typeof history !== "undefined" && history.replaceState) {
      history.replaceState(null, "", `#${id}`);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, id: SectionId) {
    const idx = SECTIONS.findIndex((s) => s.id === id);
    let nextIdx: number | null = null;
    if (e.key === "ArrowDown" || e.key === "ArrowRight")
      nextIdx = (idx + 1) % SECTIONS.length;
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft")
      nextIdx = (idx - 1 + SECTIONS.length) % SECTIONS.length;
    else if (e.key === "Home") nextIdx = 0;
    else if (e.key === "End") nextIdx = SECTIONS.length - 1;
    if (nextIdx === null) return;
    e.preventDefault();
    const next = SECTIONS[nextIdx]!;
    selectSection(next.id);
    const nav = e.currentTarget.closest("[data-nav-rail]");
    const btn = nav?.querySelector<HTMLButtonElement>(
      `[data-tab="${next.id}"]`,
    );
    btn?.focus();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)] xl:gap-8">
      {/* ── Navigasi ── */}
      <aside className="xl:sticky xl:top-20 xl:self-start">
        {/* Mobile: segmented 2×2 */}
        <div
          role="tablist"
          aria-label="Bagian pengaturan"
          className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:hidden"
        >
          {SECTIONS.map((s) => {
            const on = active === s.id;
            return (
              <button
                key={s.id}
                data-tab={s.id}
                role="tab"
                type="button"
                aria-selected={on}
                onClick={() => selectSection(s.id)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-center transition-all",
                  on
                    ? "border-primary/40 bg-primary/5 text-foreground shadow-sm"
                    : "border-border/60 bg-card/50 text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground",
                )}
              >
                <s.Icon className="size-4 shrink-0" aria-hidden />
                <span className="text-xs font-medium leading-tight">
                  {s.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Desktop: rail */}
        <nav
          data-nav-rail
          role="tablist"
          aria-label="Bagian pengaturan"
          aria-orientation="vertical"
          className="border-border/60 bg-card/50 hidden flex-col gap-1 rounded-2xl border p-2 shadow-sm xl:flex"
        >
          <p className="text-muted-foreground px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider">
            Pengaturan
          </p>
          {SECTIONS.map((s) => {
            const on = active === s.id;
            return (
              <button
                key={s.id}
                data-tab={s.id}
                role="tab"
                type="button"
                aria-selected={on}
                tabIndex={on ? 0 : -1}
                onClick={() => selectSection(s.id)}
                onKeyDown={(e) => onKeyDown(e, s.id)}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  on
                    ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                    on
                      ? "bg-primary/10 text-primary"
                      : "bg-muted/60 text-muted-foreground group-hover:text-foreground",
                  )}
                >
                  <s.Icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium leading-tight">
                    {s.label}
                  </span>
                  <span
                    className={cn(
                      "mt-0.5 block truncate text-[11px]",
                      on ? "text-muted-foreground" : "text-muted-foreground/80",
                    )}
                  >
                    {s.hint}
                  </span>
                </span>
                <ChevronRight
                  className={cn(
                    "size-4 shrink-0 transition-opacity",
                    on ? "text-muted-foreground opacity-100" : "opacity-0",
                  )}
                  aria-hidden
                />
              </button>
            );
          })}

          <div className="border-border/50 mt-2 flex items-start gap-2 border-t px-3 py-3">
            <Monitor className="text-muted-foreground mt-0.5 size-3.5 shrink-0" aria-hidden />
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              Perubahan disimpan per bagian. Kustomisasi punya pratinjau langsung.
            </p>
          </div>
        </nav>
      </aside>

      {/* ── Konten ── */}
      <div className="min-w-0">
        <header className="mb-4 hidden xl:block">
          <h2 className="text-foreground text-xl font-semibold tracking-tight">
            {meta.title}
          </h2>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
            {meta.description}
          </p>
        </header>

        <div
          key={active}
          role="tabpanel"
          aria-label={meta.title}
          tabIndex={-1}
          className="outline-none duration-200 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1"
        >
          {/* Mobile section title */}
          <div className="mb-4 xl:hidden">
            <h2 className="text-foreground text-lg font-semibold tracking-tight">
              {meta.title}
            </h2>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              {meta.description}
            </p>
          </div>
          {content[active]}
        </div>
      </div>
    </div>
  );
}
