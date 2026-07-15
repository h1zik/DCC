import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { LabDetailPage, LabModulePage } from "@/components/lab/lab-module-page";

/** Wrapper halaman list Brand Hub — delegasi ke LabModulePage (bento). */
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
    <LabModulePage
      icon={icon}
      eyebrow={eyebrow}
      title={title}
      description={subtitle}
      right={right}
      footer={footer}
    >
      {children}
    </LabModulePage>
  );
}

/** Wrapper halaman detail Brand Hub — delegasi ke LabDetailPage. */
export function BrandHubDetailPage({
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
      eyebrow="Brand & Creative Hub"
      title={title}
      description={description}
      right={right}
      backHref={backHref}
    >
      {children}
    </LabDetailPage>
  );
}
