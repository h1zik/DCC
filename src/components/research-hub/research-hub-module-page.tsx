import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { LabDetailPage, LabModulePage } from "@/components/lab/lab-module-page";

/** Wrapper halaman modul Research Hub — delegasi ke LabModulePage (bento). */
export function ResearchHubModulePage({
  icon,
  title,
  description,
  right,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <LabModulePage
      icon={icon}
      eyebrow="Research Hub"
      title={title}
      description={description}
      right={right}
    >
      {children}
    </LabModulePage>
  );
}

/** Wrapper halaman detail Research Hub — delegasi ke LabDetailPage. */
export function ResearchHubDetailPage({
  icon,
  title,
  description,
  right,
  backHref,
  children,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  right?: ReactNode;
  backHref?: string;
  children: ReactNode;
}) {
  return (
    <LabDetailPage
      icon={icon}
      eyebrow="Research Hub"
      title={title}
      description={description}
      right={right}
      backHref={backHref}
    >
      {children}
    </LabDetailPage>
  );
}
