export function directChatReplySnippet(msg: {
  body: string;
  gifUrl: string | null;
  deletedAt?: string | null;
  attachmentCount?: number;
}): string {
  if (msg.deletedAt) return "Pesan dihapus";
  const t = msg.body.trim();
  if (msg.gifUrl && t) {
    const cut = t.length > 72 ? `${t.slice(0, 72)}…` : t;
    return `${cut} · GIF`;
  }
  if (msg.gifUrl) return "GIF";
  if ((msg.attachmentCount ?? 0) > 0 && !t) {
    return msg.attachmentCount === 1 ? "Lampiran" : `${msg.attachmentCount} lampiran`;
  }
  if ((msg.attachmentCount ?? 0) > 0 && t) {
    const cut = t.length > 60 ? `${t.slice(0, 60)}…` : t;
    return `${cut} · lampiran`;
  }
  if (!t) return "(tanpa teks)";
  return t.length > 120 ? `${t.slice(0, 120)}…` : t;
}
