export function MoodboardGrid({
  assets,
}: {
  assets: { id: string; imageUrl: string; title: string | null }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
      {assets.map((a) => (
        <figure
          key={a.id}
          className="group relative overflow-hidden rounded-xl border border-border/60 bg-muted/30"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={a.imageUrl}
            alt={a.title ?? "Visual reference"}
            className="aspect-[4/5] w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          {a.title ? (
            <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-[10px] text-white line-clamp-2">
              {a.title}
            </figcaption>
          ) : null}
        </figure>
      ))}
    </div>
  );
}
