/**
 * Extract a JSON object/array from a raw model response. Strips markdown
 * fences and slices a balanced `{…}` / `[…]` block so trailing prose or
 * truncated strings don't break `JSON.parse`.
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

  const balanced = sliceBalancedJson(text, start);
  if (balanced) return balanced;

  const openChar = text[start];
  const closeChar = openChar === "{" ? "}" : "]";
  const end = text.lastIndexOf(closeChar);
  if (end > start) return text.slice(start, end + 1);
  return text;
}

/** Parse model output after {@link extractJson}. */
export function parseExtractedJson<T>(raw: string): T {
  return JSON.parse(extractJson(raw)) as T;
}

export function isJsonParseError(err: unknown): boolean {
  if (err instanceof SyntaxError) return true;
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes("json") ||
      msg.includes("unexpected token") ||
      msg.includes("unexpected end")
    );
  }
  return false;
}

function sliceBalancedJson(text: string, start: number): string | null {
  const open = text[start];
  if (open !== "{" && open !== "[") return null;
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (ch === "\\" && inString) {
      escaped = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === open) depth += 1;
    if (ch === close) {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  return null;
}
