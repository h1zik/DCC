"use client";

/**
 * Kerangka halaman "Edit profil": rail navigasi kiri (desktop) / tab horizontal
 * (mobile), menampilkan SATU bagian dalam satu waktu. Menggantikan satu scroll
 * panjang berisi banyak domain agar tidak sesak. Bagian aktif dipertahankan
 * lewat state klien sehingga router.refresh() (dari tiap simpan) tidak
 * melompatkannya kembali ke atas.
 */
import { useEffect, useState, type ReactNode } from "react";
import { Palette, ShieldCheck, Sparkles, User } from "lucide-react";
import { cn } from "@/lib/utils";

type SectionId = "profil" | "kustomisasi" | "akun" | "aplikasi";

const SECTIONS: {
  id: SectionId;
  label: string;
  hint: string;
  Icon: typeof User;
}[] = [
  { id: "profil", label: "Profil", hint: "Foto · nama · bio", Icon: User },
  {
    id: "kustomisasi",
    label: "Kustomisasi",
    hint: "Tema · frame · showcase",
    Icon: Sparkles,
  },
  {
    id: "akun",
    label: "Akun & keamanan",
    hint: "Email · WhatsApp · sandi",
    Icon: ShieldCheck,
  },
  {
    id: "aplikasi",
    label: "Tampilan aplikasi",
    hint: "Tema & warna app",
    Icon: Palette,
  },
];

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

  // Deep-link: #kustomisasi | #akun | #aplikasi | #achievements → buka bagian terkait.
  // Hash hanya bisa dibaca setelah mount (window tak ada saat render SSR), jadi
  // effect + setState di sini memang perlu — sekali saat mount saja.
  useEffect(() => {
    const h = window.location.hash.replace("#", "");
    const target: SectionId | null =
      h === "achievements" ? "kustomisasi" : isSectionId(h) ? h : null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time URL-hash sync post-hydration
    if (target) setActive(target);
  }, []);

  const content: Record<SectionId, ReactNode> = {
    profil,
    kustomisasi,
    akun,
    aplikasi,
  };
  const activeLabel = SECTIONS.find((s) => s.id === active)?.label ?? "";

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
    const nav = e.currentTarget.parentElement;
    const btn = nav?.querySelector<HTMLButtonElement>(
      `[data-tab="${next.id}"]`,
    );
    btn?.focus();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[236px_minmax(0,1fr)] lg:gap-8">
      <nav
        role="tablist"
        aria-label="Bagian pengaturan"
        aria-orientation="vertical"
        className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] lg:sticky lg:top-20 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0 [&::-webkit-scrollbar]:hidden"
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
              tabIndex={on ? 0 : -1}
              onClick={() => selectSection(s.id)}
              onKeyDown={(e) => onKeyDown(e, s.id)}
              className={cn(
                "group relative flex shrink-0 items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                on
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {on ? (
                <span
                  className="absolute inset-y-2 left-0 hidden w-0.5 rounded-full bg-sidebar-primary lg:block"
                  aria-hidden
                />
              ) : null}
              <s.Icon
                className={cn(
                  "size-[18px] shrink-0",
                  on
                    ? "text-sidebar-primary"
                    : "text-muted-foreground group-hover:text-foreground",
                )}
                aria-hidden
              />
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="text-sm font-medium tracking-tight">
                  {s.label}
                </span>
                <span
                  className={cn(
                    "hidden truncate text-[11.5px] lg:block",
                    on ? "text-accent-foreground/70" : "text-muted-foreground",
                  )}
                >
                  {s.hint}
                </span>
              </span>
            </button>
          );
        })}
      </nav>

      <div className="min-w-0">
        <div
          key={active}
          role="tabpanel"
          aria-label={activeLabel}
          tabIndex={-1}
          className="outline-none duration-200 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1"
        >
          {content[active]}
        </div>
      </div>
    </div>
  );
}
