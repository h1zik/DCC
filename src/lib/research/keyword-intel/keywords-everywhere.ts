import "server-only";

export type KeKeywordData = {
  keyword: string;
  vol: number;
  cpc: { currency: string; value: string };
  competition: number;
  trend: number[];
};

export function isKeywordsEverywhereConfigured(): boolean {
  return !!process.env.KEYWORDS_EVERYWHERE_API_KEY?.trim();
}

export async function fetchKeywordVolumes(
  keywords: string[],
): Promise<KeKeywordData[]> {
  const apiKey = process.env.KEYWORDS_EVERYWHERE_API_KEY?.trim();
  if (!apiKey || keywords.length === 0) return [];

  const unique = [...new Set(keywords.map((k) => k.trim().toLowerCase()))].slice(
    0,
    100,
  );

  try {
    const res = await fetch(
      "https://api.keywordseverywhere.com/v1/get_keyword_data",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          country: "id",
          currency: "IDR",
          dataSource: "gkp",
          kw: unique,
        }),
      },
    );

    if (!res.ok) {
      console.warn("[keywords-everywhere] API error", res.status, await res.text());
      return [];
    }

    const json = (await res.json()) as { data?: KeKeywordData[] };
    return json.data ?? [];
  } catch (err) {
    console.warn("[keywords-everywhere] fetch gagal", err);
    return [];
  }
}
