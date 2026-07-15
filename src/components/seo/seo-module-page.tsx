import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { LabDetailPage, LabModulePage } from "@/components/lab/lab-module-page";

/** Wrapper halaman modul SEO — delegasi ke LabModulePage (skin bento). */
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
    <LabModulePage
      icon={icon}
      eyebrow="SEO Toolkit"
      title={title}
      description={description}
      right={right}
    >
      {children}
    </LabModulePage>
  );
}

/** Wrapper halaman detail SEO — delegasi ke LabDetailPage. */
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
    <LabDetailPage
      icon={icon}
      eyebrow="SEO Toolkit"
      title={title}
      description={description}
      right={right}
      backHref={backHref}
    >
      {children}
    </LabDetailPage>
  );
}
