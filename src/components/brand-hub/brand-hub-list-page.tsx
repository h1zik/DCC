import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
  BrandHubPageHeader,
  BrandHubPageShell,
} from "@/components/brand-hub/brand-hub-primitives";

export function BrandHubListPage({
  icon,
  eyebrow = "Brand & Creative Hub",
  title,
  subtitle,
  right,
  footer,
  children,
}: {
  icon: LucideIcon;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <BrandHubPageShell>
      <BrandHubPageHeader
        variant="compact"
        icon={icon}
        eyebrow={eyebrow}
        title={title}
        description={subtitle}
        right={right}
        footer={footer}
      />
      {children}
    </BrandHubPageShell>
  );
}

export function BrandHubDetailPage({
  icon,
  title,
  description,
  right,
  children,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <BrandHubPageShell>
      <BrandHubPageHeader
        variant="detail"
        icon={icon}
        title={title}
        description={description}
        right={right}
      />
      {children}
    </BrandHubPageShell>
  );
}
