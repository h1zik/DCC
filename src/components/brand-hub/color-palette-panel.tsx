export function ColorPalettePanel({
  palette,
  derivedFromCount,
}: {
  palette: {
    primary?: string;
    secondary?: string;
    accent?: string;
    neutrals?: string[];
    rationale?: string;
  } | null;
  derivedFromCount?: number;
}) {
  if (!palette) return null;
  const swatches = [
    palette.primary,
    palette.secondary,
    palette.accent,
    ...(palette.neutrals ?? []),
  ].filter(Boolean) as string[];

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">Color Palette</h3>
        {derivedFromCount != null ? (
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
            Derived from {derivedFromCount} visual assets
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {swatches.map((hex) => (
          <div key={hex} className="flex flex-col items-center gap-1">
            <span
              className="size-12 rounded-lg border border-border shadow-sm"
              style={{ backgroundColor: hex }}
            />
            <span className="text-muted-foreground font-mono text-[10px]">{hex}</span>
          </div>
        ))}
      </div>
      {palette.rationale ? (
        <p className="text-muted-foreground mt-3 text-sm">{palette.rationale}</p>
      ) : null}
    </div>
  );
}
