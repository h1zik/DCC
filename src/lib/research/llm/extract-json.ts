/**
 * Extract a JSON object/array from a raw model response. Strips markdown
 * fences and, as a last resort, slices from the first `{`/`[` to the matching
 * last bracket so trailing prose doesn't break `JSON.parse`.
 */
export function extractJson(raw: string): string {
  let text = raw.trim();
  text = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "");
  text = text.replace(/```\s*$/i, "").trim();

  try {
    JSON.parse(text);
    return text;
  } catch {
    /* fall through to bracket slicing */
  }

  const firstObj = text.indexOf("{");
  const firstArr = text.indexOf("[");
  const start =
    firstObj === -1
      ? firstArr
      : firstArr === -1
        ? firstObj
        : Math.min(firstObj, firstArr);
  if (start === -1) return text;

  const openChar = text[start];
  const closeChar = openChar === "{" ? "}" : "]";
  const end = text.lastIndexOf(closeChar);
  if (end > start) return text.slice(start, end + 1);
  return text;
}
