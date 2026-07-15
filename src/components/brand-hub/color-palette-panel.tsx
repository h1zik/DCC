/** Panel palet warna gaya bento — swatch besar berlabel peran + rationale. */
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
    palette.primary ? { hex: palette.primary, role: "Primary" } : null,
    palette.secondary ? { hex: palette.secondary, role: "Secondary" } : null,
    palette.accent ? { hex: palette.accent, role: "Accent" } : null,
    ...(palette.neutrals ?? []).map((hex) =>
      hex ? { hex, role: "Neutral" } : null,
    ),
  ].filter(Boolean) as { hex: string; role: string }[];

  return (
    <div className="flex flex-col gap-3">
      {derivedFromCount != null ? (
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
          <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
          Diturunkan dari {derivedFromCount} visual asset
        </span>
      ) : null}
      <div className="flex flex-wrap gap-3">
        {swatches.map((s, i) => (
          <div
            key={`${s.role}-${s.hex}-${i}`}
            className="flex min-w-16 flex-col items-center gap-1.5"
          >
            <span
              className="size-14 rounded-xl border border-border/70 shadow-sm"
              style={{ backgroundColor: s.hex }}
              title={`${s.role} · ${s.hex}`}
            />
            <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
              {s.role}
            </span>
            <span className="text-muted-foreground -mt-1 font-mono text-[10px]">
              {s.hex}
            </span>
          </div>
        ))}
      </div>
      {palette.rationale ? (
        <p className="text-muted-foreground text-sm leading-relaxed">
          {palette.rationale}
        </p>
      ) : null}
    </div>
  );
}
