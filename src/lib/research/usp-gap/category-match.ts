/** Fuzzy match kategori untuk auto-suggest sumber riset. */
export function categoryMatch(haystack: string, category: string): boolean {
  const h = haystack.toLowerCase();
  const c = category.toLowerCase();
  return (
    h.includes(c) ||
    c.split(/\s+/).some((w) => w.length > 2 && h.includes(w))
  );
}
