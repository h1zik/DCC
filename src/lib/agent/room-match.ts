import type { AgentRoomSummary } from "./types";

const ROOM_PREFIX_RE = /^(ruang|room|ruangan|workspace)\s+/i;

export function normalizeRoomSearchKey(value: string): string {
  return value
    .toLowerCase()
    .replace(ROOM_PREFIX_RE, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function roomSearchTokens(value: string): string[] {
  return normalizeRoomSearchKey(value)
    .split(" ")
    .filter((t) => t.length > 2);
}

function tokenOverlapScore(queryTokens: string[], roomTokens: string[]): number {
  if (roomTokens.length === 0) return 0;

  let matched = 0;
  for (const roomToken of roomTokens) {
    const direct = queryTokens.includes(roomToken);
    if (direct) {
      matched += 1;
      continue;
    }
    const fuzzy = queryTokens.some(
      (q) =>
        q.includes(roomToken) ||
        roomToken.includes(q) ||
        levenshteinRatio(q, roomToken) >= 0.82,
    );
    if (fuzzy) matched += 0.85;
  }

  const recall = matched / roomTokens.length;
  const precision =
    queryTokens.length === 0
      ? 0
      : matched / Math.max(queryTokens.length, roomTokens.length);

  return recall * 0.75 + precision * 0.25;
}

function levenshteinRatio(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;

  const matrix: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1,
        matrix[i]![j - 1]! + 1,
        matrix[i - 1]![j - 1]! + cost,
      );
    }
  }

  const distance = matrix[a.length]![b.length]!;
  const maxLen = Math.max(a.length, b.length);
  return 1 - distance / maxLen;
}

export function scoreRoomNameMatch(query: string, roomName: string): number {
  const qKey = normalizeRoomSearchKey(query).replace(/\s/g, "");
  const rKey = normalizeRoomSearchKey(roomName).replace(/\s/g, "");
  if (!qKey || !rKey) return 0;

  if (qKey === rKey) return 1;
  if (qKey.includes(rKey) || rKey.includes(qKey)) return 0.92;

  const qTokens = roomSearchTokens(query);
  const rTokens = roomSearchTokens(roomName);
  const tokenScore = tokenOverlapScore(qTokens, rTokens);
  const fuzzyScore = levenshteinRatio(qKey, rKey);

  return Math.max(tokenScore, fuzzyScore * 0.88);
}

export type RoomMatchResult =
  | { kind: "exact"; room: AgentRoomSummary }
  | { kind: "fuzzy"; room: AgentRoomSummary; score: number }
  | {
      kind: "suggest";
      query: string;
      suggestions: { room: AgentRoomSummary; score: number }[];
    }
  | { kind: "not_found"; query: string };

const AUTO_MATCH_MIN_SCORE = 0.62;
const SUGGEST_MIN_SCORE = 0.38;
const AUTO_MATCH_MIN_GAP = 0.18;

export function matchAgentRoom(
  query: string,
  rooms: AgentRoomSummary[],
): RoomMatchResult {
  const raw = query.trim();
  if (!raw) return { kind: "not_found", query };

  const byId = rooms.find((r) => r.id === raw);
  if (byId) return { kind: "exact", room: byId };

  const q = raw.toLowerCase();
  const exact = rooms.find((r) => r.name.toLowerCase() === q);
  if (exact) return { kind: "exact", room: exact };

  const normalizedQuery = normalizeRoomSearchKey(raw);
  const normalizedExact = rooms.find(
    (r) => normalizeRoomSearchKey(r.name) === normalizedQuery,
  );
  if (normalizedExact) return { kind: "exact", room: normalizedExact };

  const partial = rooms.filter((r) => {
    const name = r.name.toLowerCase();
    return name.includes(q) || q.includes(name);
  });
  if (partial.length === 1) return { kind: "exact", room: partial[0]! };

  const ranked = rooms
    .map((room) => ({
      room,
      score: scoreRoomNameMatch(raw, room.name),
    }))
    .filter((row) => row.score >= SUGGEST_MIN_SCORE)
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) {
    return { kind: "not_found", query: raw };
  }

  const best = ranked[0]!;
  const second = ranked[1];
  const qTokens = roomSearchTokens(raw);
  const rTokens = roomSearchTokens(best.room.name);
  const extraQueryWords = qTokens.filter(
    (t) =>
      !rTokens.some(
        (rt) => rt === t || rt.includes(t) || t.includes(rt),
      ),
  );
  const hasExtraWords = extraQueryWords.length > 0;

  const confident =
    best.score >= AUTO_MATCH_MIN_SCORE &&
    (!second || best.score - second.score >= AUTO_MATCH_MIN_GAP) &&
    !(hasExtraWords && best.score < 0.98);

  if (confident) {
    return { kind: "fuzzy", room: best.room, score: best.score };
  }

  return {
    kind: "suggest",
    query: raw,
    suggestions: ranked.slice(0, 3),
  };
}

export function formatRoomSuggestMessage(
  query: string,
  suggestions: { room: AgentRoomSummary; score: number }[],
): string {
  if (suggestions.length === 1) {
    const name = suggestions[0]!.room.name;
    return `SUGGEST_ROOM: Apakah maksudmu "${name}"? (User mengetik "${query}"). Tanyakan konfirmasi singkat ke user. Jika ya, gunakan roomNameOrId "${name}" di tool berikutnya.`;
  }

  const names = suggestions.map((s) => `"${s.room.name}"`).join(", ");
  return `SUGGEST_ROOM: Apakah maksudmu salah satu dari ${names}? (User mengetik "${query}"). Tanyakan konfirmasi ke user lalu lanjutkan.`;
}
