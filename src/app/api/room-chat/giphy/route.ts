import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

type GiphyImages = {
  downsized?: { url?: string };
  fixed_height?: { url?: string };
  fixed_height_small?: { url?: string };
  preview_gif?: { url?: string };
  original?: { url?: string };
};

type GiphyDatum = { images?: GiphyImages };

/**
 * Proxy pencarian Giphy (butuh `GIPHY_API_KEY` di env).
 * Kunci tetap di server — tidak perlu `NEXT_PUBLIC_*`.
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const key = process.env.GIPHY_API_KEY;
  if (!key) {
    return NextResponse.json({ configured: false as const, items: [] });
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim() || "happy";
  const limit = Math.min(
    50,
    Math.max(8, Number.parseInt(searchParams.get("limit") ?? "24", 10) || 24),
  );

  const url = new URL("https://api.giphy.com/v1/gifs/search");
  url.searchParams.set("api_key", key);
  url.searchParams.set("q", q.slice(0, 120));
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("rating", "pg-13");
  url.searchParams.set("lang", "en");

  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  if (!res.ok) {
    return NextResponse.json(
      { error: "Giphy tidak tersedia saat ini.", configured: true, items: [] },
      { status: 502 },
    );
  }

  const json = (await res.json()) as { data?: GiphyDatum[] };
  const items = (json.data ?? [])
    .map((item) => {
      const im = item.images;
      const full =
        im?.downsized?.url ??
        im?.fixed_height?.url ??
        im?.original?.url;
      const preview =
        im?.preview_gif?.url ??
        im?.fixed_height_small?.url ??
        im?.fixed_height?.url ??
        full;
      if (!full) return null;
      return { url: full, preview: preview ?? full };
    })
    .filter((x): x is { url: string; preview: string } => x != null);

  return NextResponse.json({ configured: true as const, items });
}
