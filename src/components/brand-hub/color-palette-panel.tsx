export function ColorPalettePanel({
  palette,
}: {
  palette: {
    primary?: string;
    secondary?: string;
    accent?: string;
    neutrals?: string[];
    rationale?: string;
  } | null;
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
      <h3 className="mb-3 text-sm font-semibold">Color Palette</h3>
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
