const URL_REGEX = /((?:https?:\/\/|www\.)[^\s<>\[\]{}|\\^`"]+)/gi;

function trimUrlPunctuation(url: string): string {
  return url.replace(/[.,;:!?)}\]'"]+$/, "");
}

function toSafeHref(raw: string): string | null {
  const url = trimUrlPunctuation(raw.trim());
  const href = /^www\./i.test(url) ? `https://${url}` : url;
  try {
    const parsed = new URL(href);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export type LinkifySegment =
  | { type: "text"; value: string }
  | { type: "link"; value: string; href: string };

export function splitLinkifiedText(text: string): LinkifySegment[] {
  if (!text) return [];

  const segments: LinkifySegment[] = [];
  let lastIndex = 0;
  const re = new RegExp(URL_REGEX.source, "gi");
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }

    const raw = match[0];
    const href = toSafeHref(raw);
    if (href) {
      segments.push({ type: "link", value: raw, href });
    } else {
      segments.push({ type: "text", value: raw });
    }

    lastIndex = match.index + raw.length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }

  return segments;
}
