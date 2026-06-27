import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
  ResearchHubPageHeader,
  ResearchHubPageShell,
} from "@/components/research-hub/research-hub-primitives";

/** Wrapper halaman modul SEO (list/overview) — reuse shell Research Hub. */
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
    <ResearchHubPageShell>
      <ResearchHubPageHeader
        variant="compact"
        icon={icon}
        title={title}
        description={description}
        right={right}
      />
      {children}
    </ResearchHubPageShell>
  );
}

/** Wrapper halaman detail SEO. */
export function SeoDetailPage({
  icon,
  title,
  description,
  right,
  children,
}: {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <ResearchHubPageShell>
      <ResearchHubPageHeader
        variant="detail"
        icon={icon}
        title={title}
        description={description}
        right={right}
      />
      {children}
    </ResearchHubPageShell>
  );
}
