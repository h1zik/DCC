import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
  LabEmptyState,
  LabPageHeader,
  LabPageShell,
  LabSection,
  LabSidebarItem,
  LabStatChip,
  lab,
} from "@/components/lab/lab-primitives";

/**
 * Primitives Research Hub — kini delegasi tipis ke Lab primitives sehingga
 * seluruh konsumen lama `hub.*` otomatis memakai skin bento global
 * (marker class `lab-*` di-reskin lab-bento.css). Jangan tambah style baru
 * di sini; pakai `lab`/`Lab*` langsung untuk kode baru.
 */
export const hub = lab;

export function ResearchHubPageShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <LabPageShell className={className}>{children}</LabPageShell>;
}

export function ResearchHubPageHeader({
  icon,
  eyebrow,
  title,
  description,
  right,
  footer,
  variant = "default",
  className,
}: {
  icon?: LucideIcon;
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  right?: ReactNode;
  footer?: ReactNode;
  variant?: "default" | "compact" | "detail";
  className?: string;
}) {
  return (
    <LabPageHeader
      icon={icon}
      eyebrow={eyebrow}
      title={title}
      description={description}
      right={right}
      footer={footer}
      variant={variant}
      className={className}
    />
  );
}

export function ResearchHubSection(
  props: Parameters<typeof LabSection>[0],
) {
  return <LabSection {...props} />;
}

export function ResearchHubEmptyState(
  props: Parameters<typeof LabEmptyState>[0],
) {
  return <LabEmptyState {...props} />;
}

export function ResearchHubStatChip(
  props: Parameters<typeof LabStatChip>[0],
) {
  return <LabStatChip {...props} />;
}

export function ResearchHubSidebarItem(
  props: Parameters<typeof LabSidebarItem>[0],
) {
  return <LabSidebarItem {...props} />;
}
