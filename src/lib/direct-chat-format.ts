/** Util tampilan chat pribadi yang dipakai lintas komponen (klien & server aman). */

export function directChatAuthorLabel(name: string | null, email: string) {
  return name?.trim() || email;
}

export function directChatAuthorInitial(name: string | null, email: string) {
  return (name?.trim() || email).slice(0, 1).toUpperCase() || "?";
}

export function isDirectChatUserOnline(lastSeenAt: string | null): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < 2 * 60 * 1000;
}

export function isSameCalendarDay(a: Date, b: Date) {
  return (
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  );
}

/** Jam saja untuk hari ini; tanggal + jam untuk hari lain. */
export function formatDirectChatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("id-ID", {
    ...(isSameCalendarDay(d, new Date()) ? {} : { day: "numeric", month: "short" }),
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDirectChatClock(iso: string) {
  return new Date(iso).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Tanggal lengkap untuk hasil pencarian & arsip; tahun hanya bila berbeda. */
export function formatDirectChatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}

export function formatDirectChatMonth(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });
}

export function formatDirectChatPresence(lastSeenAt: Date | string | null) {
  if (!lastSeenAt) return "Belum ada aktivitas";
  const iso =
    typeof lastSeenAt === "string" ? lastSeenAt : lastSeenAt.toISOString();
  if (isDirectChatUserOnline(iso)) return "Online sekarang";
  return `Terakhir aktif ${formatDirectChatTime(iso)}`;
}
