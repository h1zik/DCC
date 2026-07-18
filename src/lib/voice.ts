/**
 * Helper bersama (aman untuk client & server) untuk fitur voice channel.
 * Nama room LiveKit memakai konvensi `voice:{roomId}:{channelId}` supaya satu
 * channel voice = satu room LiveKit yang terisolasi.
 */

export const VOICE_ROOM_PREFIX = "voice";

export function voiceRoomName(roomId: string, channelId: string): string {
  return `${VOICE_ROOM_PREFIX}:${roomId}:${channelId}`;
}

export function parseVoiceRoomName(
  name: string,
): { roomId: string; channelId: string } | null {
  const parts = name.split(":");
  if (parts.length !== 3 || parts[0] !== VOICE_ROOM_PREFIX) return null;
  const [, roomId, channelId] = parts;
  if (!roomId || !channelId) return null;
  return { roomId, channelId };
}

/** Snapshot satu peserta voice untuk ditampilkan ke user yang belum join. */
export type VoiceParticipantView = {
  userId: string;
  name: string;
  image: string | null;
  isMicMuted: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
};

/** Peta channelId → daftar peserta yang sedang tersambung. */
export type VoiceParticipantsByChannel = Record<string, VoiceParticipantView[]>;

/** Interval polling daftar peserta voice di sisi client (ms). */
export const VOICE_PARTICIPANTS_POLL_INTERVAL_MS = 10_000;
