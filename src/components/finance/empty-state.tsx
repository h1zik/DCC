import { cn } from "@/lib/utils";

type Props = {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
};

/**
 * Empty state ramah untuk modul keuangan: ikon lembut, pesan, aksi utama.
 * Jauh lebih hangat dari "Belum ada data." standar.
 */
export function FinanceEmptyState({ icon, title, description, action, className }: Props) {
  return (
    <div
      className={cn(
        "border-border/60 bg-muted/20 flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-10 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="text-muted-foreground/80 bg-background mb-3 flex size-10 items-center justify-center rounded-xl border border-border/60 shadow-sm">
          {icon}
        </div>
      ) : null}
      <h3 className="text-foreground text-sm font-semibold tracking-tight">
        {title}
      </h3>
      {description ? (
        <p className="text-muted-foreground mt-1 max-w-sm text-xs leading-relaxed">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
