import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Panel konten utama tiap bagian edit profil. */
export function EditPanel({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-border/60 bg-card/80 rounded-2xl border shadow-sm backdrop-blur-sm",
        className,
      )}
    >
      <div className="border-border/50 border-b px-5 py-4 sm:px-6">
        <h2 className="text-foreground text-lg font-semibold tracking-tight">
          {title}
        </h2>
        {description ? (
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
            {description}
          </p>
        ) : null}
      </div>
      <div className="px-5 py-5 sm:px-6 sm:py-6">{children}</div>
    </div>
  );
}

/** Kelompok field di dalam panel (mis. Background, Frame). */
export function EditGroup({
  title,
  description,
  children,
  action,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-foreground text-sm font-semibold tracking-tight">
            {title}
          </h3>
          {description ? (
            <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

/** Bar aksi sticky (Simpan / Batal). */
export function EditStickyBar({
  dirty,
  pending,
  onSave,
  onCancel,
  saveLabel = "Simpan perubahan",
}: {
  dirty: boolean;
  pending: boolean;
  onSave: () => void;
  onCancel: () => void;
  saveLabel?: string;
}) {
  if (!dirty) return null;
  return (
    <div className="border-border/60 bg-background/90 supports-[backdrop-filter]:bg-background/75 sticky bottom-0 z-20 -mx-5 mt-6 border-t px-5 py-3 backdrop-blur-md sm:-mx-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="text-muted-foreground mr-auto text-xs">
          Perubahan belum disimpan
        </span>
        <button
          type="button"
          disabled={pending}
          onClick={onCancel}
          className="text-muted-foreground hover:text-foreground rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50"
        >
          Batal
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onSave}
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition-colors disabled:opacity-50"
        >
          {pending ? "Menyimpan…" : saveLabel}
        </button>
      </div>
    </div>
  );
}
