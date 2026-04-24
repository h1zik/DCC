type TypingEntry = {
  userId: string;
  label: string;
  at: number;
};

const TYPING_TTL_MS = 6000;
const byRoom = new Map<string, Map<string, TypingEntry>>();

function cleanupRoom(roomId: string, now: number): Map<string, TypingEntry> {
  const room = byRoom.get(roomId) ?? new Map<string, TypingEntry>();
  for (const [uid, entry] of room) {
    if (now - entry.at > TYPING_TTL_MS) {
      room.delete(uid);
    }
  }
  if (room.size === 0) byRoom.delete(roomId);
  else byRoom.set(roomId, room);
  return room;
}

export function markRoomTyping(roomId: string, userId: string, label: string) {
  const now = Date.now();
  const room = cleanupRoom(roomId, now);
  room.set(userId, { userId, label, at: now });
  byRoom.set(roomId, room);
}

export function listRoomTyping(roomId: string, viewerUserId: string): string[] {
  const now = Date.now();
  const room = cleanupRoom(roomId, now);
  return [...room.values()]
    .filter((entry) => entry.userId !== viewerUserId)
    .sort((a, b) => b.at - a.at)
    .map((entry) => entry.label);
}
