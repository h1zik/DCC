import { Inbox, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Empty-state seragam: kartu bergaris putus-putus dengan ikon, judul,
 * deskripsi opsional, dan aksi opsional. Dipakai lintas halaman agar tampilan
 * "belum ada data" konsisten.
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-card text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm",
        className,
      )}
    >
      <Icon className="text-muted-foreground/50 mx-auto mb-3 size-8" aria-hidden />
      <p className="text-foreground font-medium">{title}</p>
      {description ? <p className="mt-1 text-xs">{description}</p> : null}
      {action ? <div className="mt-3 flex justify-center">{action}</div> : null}
    </div>
  );
}
