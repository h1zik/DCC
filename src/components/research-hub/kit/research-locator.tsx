"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { findResearchHubLocation } from "@/components/research-hub/research-hub-module-nav";
import { researchModuleFromPathname } from "@/lib/research/research-module-models";
import { formatTierModelLabel } from "@/lib/research/research-module-models";
import { cn } from "@/lib/utils";

/**
 * Posisi halaman di alur riset (tahap 1–3). Angka tahap adalah informasi —
 * zona Research Hub memang berurutan: temukan → pahami pasar → susun strategi.
 */
export function ResearchStepLocator({ className }: { className?: string }) {
  const pathname = usePathname() ?? "/research-hub";
  const location = findResearchHubLocation(pathname);
  if (!location?.zone) return null;

  return (
    <p className={cn("rh-meta flex items-center gap-2", className)}>
      <span
        className="rh-step-dot"
        aria-label={`Tahap ${location.zone.step} dari 3`}
      >
        {location.zone.step}
      </span>
      <span>{location.zone.label}</span>
    </p>
  );
}

/** Link kembali ke halaman indeks modul, dengan nama modulnya (bukan sekadar "Kembali"). */
export function ResearchBackLink({
  href,
  label,
  className,
}: {
  href?: string;
  label?: string;
  className?: string;
}) {
  const pathname = usePathname() ?? "/research-hub";
  const location = findResearchHubLocation(pathname);
  const target = href ?? location?.item.href ?? "/research-hub";
  const text = label ?? location?.item.label ?? "Research Hub";

  return (
    <Link
      href={target}
      className={cn(
        "rh-meta hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-md font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
        className,
      )}
    >
      <ArrowLeft className="size-3.5" aria-hidden />
      {text}
    </Link>
  );
}

/**
 * Satu baris keterangan model AI untuk modul (hanya halaman indeks modul).
 * Menggantikan kotak petunjuk bergaris putus di atas header.
 */
export function ResearchModelLine({ className }: { className?: string }) {
  const pathname = usePathname() ?? "";
  const location = findResearchHubLocation(pathname);
  if (!location || location.isDetail || !location.zone) return null;
  const profile = researchModuleFromPathname(pathname);
  if (!profile) return null;

  return (
    <p className={cn("rh-meta", className)}>
      <span className="text-foreground/80 font-medium">AI:</span>{" "}
      {profile.steps.map((step, i) => (
        <span key={`${step.label}-${step.tier}`}>
          {i > 0 ? ", " : null}
          {step.label.charAt(0).toLowerCase() + step.label.slice(1)}{" "}
          <span className="text-foreground/70">({formatTierModelLabel(step.tier)})</span>
        </span>
      ))}
    </p>
  );
}
