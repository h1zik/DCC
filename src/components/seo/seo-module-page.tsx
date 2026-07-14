import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
  LabPageHeader,
  LabPageShell,
} from "@/components/lab/lab-primitives";

/** Wrapper halaman modul SEO (list/overview) — memakai shell Dominatus Lab. */
export function SeoModulePage({
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
    <LabPageShell>
      <LabPageHeader
        variant="compact"
        eyebrow="SEO Toolkit"
        icon={icon}
        title={title}
        description={description}
        right={right}
      />
      {children}
    </LabPageShell>
  );
}

/** Wrapper halaman detail SEO. */
export function SeoDetailPage({
  icon,
  title,
  description,
  right,
  backHref,
  children,
}: {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  right?: ReactNode;
  backHref?: string;
  children: ReactNode;
}) {
  return (
    <LabPageShell>
      <LabPageHeader
        variant="detail"
        eyebrow="SEO Toolkit"
        icon={icon}
        title={title}
        description={description}
        right={right}
        backHref={backHref}
      />
      {children}
    </LabPageShell>
  );
}
