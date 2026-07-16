export type AdLibraryApifyOutcome = "waiting" | "succeeded" | "failed";

/**
 * Apify dapat berada di READY/RUNNING cukup lama untuk scrape besar. Semua
 * status non-terminal harus tetap dianggap menunggu agar DCC tidak membuat
 * false failure hanya karena actor belum selesai.
 */
export function getAdLibraryApifyOutcome(
  status: string,
): AdLibraryApifyOutcome {
  if (status === "SUCCEEDED") return "succeeded";
  if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
    return "failed";
  }
  return "waiting";
}
