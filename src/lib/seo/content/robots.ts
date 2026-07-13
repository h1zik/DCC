/**
 * Parser robots.txt minimal untuk fetch halaman kompetitor: hormati aturan
 * `Disallow` pada grup `User-agent: *`. Pure agar mudah di-test. Sengaja
 * sederhana — `*` di pattern di-treat sebagai batas prefix match, `$` diabaikan
 * (konservatif).
 */

/** Ambil daftar rule Disallow yang berlaku untuk user-agent `*`. */
export function parseDisallowRules(robotsTxt: string): string[] {
  const rules: string[] = [];
  /** Apakah grup yang sedang dibaca mencakup user-agent `*`. */
  let groupIsStar = false;
  /** True bila baris sebelumnya adalah `User-agent:` (masih mengumpulkan agen grup). */
  let collectingAgents = false;

  for (const rawLine of robotsTxt.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const sep = line.indexOf(":");
    if (sep === -1) continue;
    const field = line.slice(0, sep).trim().toLowerCase();
    const value = line.slice(sep + 1).trim();

    if (field === "user-agent") {
      if (!collectingAgents) {
        // Grup baru dimulai.
        groupIsStar = false;
        collectingAgents = true;
      }
      if (value === "*") groupIsStar = true;
      continue;
    }

    collectingAgents = false;
    if (field === "disallow" && groupIsStar && value) rules.push(value);
  }
  return rules;
}

/** Cek apakah path boleh di-fetch menurut rules `Disallow` user-agent `*`. */
export function isPathAllowed(robotsTxt: string, path: string): boolean {
  const rules = parseDisallowRules(robotsTxt);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  for (const rule of rules) {
    // Konservatif: buang trailing "$", cocokkan prefix sebelum "*" pertama.
    const cleaned = rule.replace(/\$$/, "");
    const prefix = cleaned.split("*")[0];
    if (prefix && normalizedPath.startsWith(prefix)) return false;
    if (!prefix && cleaned.includes("*")) return false; // "Disallow: *" → blokir semua
  }
  return true;
}
