/**
 * Prisma serializes queries as JSON. Lone UTF-16 surrogates (e.g. from
 * `.slice()` mid-emoji) cause "unexpected end of hex escape" on insert.
 */

/** Drop NUL bytes and unpaired UTF-16 surrogates. */
export function stripInvalidUnicode(value: string): string {
  if (!value) return "";

  let out = "";
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code === 0) continue;

    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        out += value[i]! + value[i + 1]!;
        i++;
      }
      continue;
    }

    if (code >= 0xdc00 && code <= 0xdfff) continue;
    out += value[i]!;
  }

  return out;
}

/** Truncate without splitting emoji / surrogate pairs. */
export function truncatePrismaString(value: string, maxLength: number): string {
  const clean = stripInvalidUnicode(value);
  if (maxLength <= 0) return "";
  const chars = [...clean];
  if (chars.length <= maxLength) return clean;
  return chars.slice(0, maxLength).join("");
}

export function sanitizePrismaText(value: string, maxLength?: number): string {
  let text = stripInvalidUnicode(value);
  if (maxLength != null) text = truncatePrismaString(text, maxLength);
  return text.trim();
}

export function sanitizePrismaOptionalText(
  value: string | null | undefined,
  maxLength?: number,
): string | null {
  if (value == null) return null;
  const text = sanitizePrismaText(value, maxLength);
  return text.length > 0 ? text : null;
}
