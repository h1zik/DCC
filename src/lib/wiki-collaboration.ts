export type WikiLockState = {
  editLockedById: string | null;
  editLockExpiresAt: Date | null;
};

export function isWikiLockAvailable(
  lock: WikiLockState,
  userId: string,
  nowMs = Date.now(),
): boolean {
  if (!lock.editLockedById || lock.editLockedById === userId) return true;
  if (!lock.editLockExpiresAt) return true;
  return lock.editLockExpiresAt.getTime() <= nowMs;
}

export function uniqueWikiMentionIds(userIds: string[], authorId: string): string[] {
  return [...new Set(userIds.map((id) => id.trim()).filter(Boolean))]
    .filter((id) => id !== authorId)
    .slice(0, 10);
}
