"use client";

import { usePathname } from "next/navigation";
import { researchModuleFromPathname } from "@/lib/research/research-module-models";
import { ResearchModuleModelHint } from "@/components/research-hub/research-model-badge";

/** Petunjuk tier Flash/Pro di halaman indeks modul (bukan detail). */
export function ResearchHubModuleHint() {
  const pathname = usePathname() ?? "";
  if (pathname === "/research-hub") return null;

  const profile = researchModuleFromPathname(pathname);
  if (!profile) return null;

  const segments = pathname.split("/").filter(Boolean);
  const isModuleRoot = segments.length === 2;
  if (!isModuleRoot) return null;

  return <ResearchModuleModelHint profile={profile} />;
}
