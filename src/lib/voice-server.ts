import {
  AccessToken,
  RoomServiceClient,
  TrackSource,
  type ParticipantInfo,
} from "livekit-server-sdk";
import {
  voiceRoomName,
  parseVoiceRoomName,
  VOICE_ROOM_PREFIX,
  type VoiceParticipantsByChannel,
  type VoiceParticipantView,
} from "@/lib/voice";

type VoiceConfig = {
  url: string;
  apiKey: string;
  apiSecret: string;
};

function readVoiceConfig(): VoiceConfig | null {
  const url = process.env.LIVEKIT_URL?.trim();
  const apiKey = process.env.LIVEKIT_API_KEY?.trim();
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
  if (!url || !apiKey || !apiSecret) return null;
  return { url, apiKey, apiSecret };
}

/** Voice hanya aktif bila ketiga env LiveKit terisi (fail-closed). */
export function isVoiceConfigured(): boolean {
  return readVoiceConfig() !== null;
}

let roomService: RoomServiceClient | null = null;

function getRoomService(config: VoiceConfig): RoomServiceClient {
  if (!roomService) {
    // RoomServiceClient menerima URL ws(s):// dan mengubahnya ke http(s) sendiri.
    roomService = new RoomServiceClient(
      config.url,
      config.apiKey,
      config.apiSecret,
    );
  }
  return roomService;
}

const VOICE_TOKEN_TTL_SECONDS = 6 * 60 * 60;

export async function mintVoiceToken(input: {
  roomId: string;
  channelId: string;
  userId: string;
  name: string;
  image: string | null;
}): Promise<{ token: string; serverUrl: string }> {
  const config = readVoiceConfig();
  if (!config) throw new Error("LiveKit belum dikonfigurasi.");

  const at = new AccessToken(config.apiKey, config.apiSecret, {
    identity: input.userId,
    name: input.name,
    metadata: JSON.stringify({ image: input.image }),
    ttl: VOICE_TOKEN_TTL_SECONDS,
  });
  at.addGrant({
    roomJoin: true,
    room: voiceRoomName(input.roomId, input.channelId),
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  return { token: await at.toJwt(), serverUrl: config.url };
}

function toParticipantView(p: ParticipantInfo): VoiceParticipantView {
  let image: string | null = null;
  if (p.metadata) {
    try {
      const meta = JSON.parse(p.metadata) as { image?: unknown };
      if (typeof meta.image === "string") image = meta.image;
    } catch {
      // metadata bukan JSON — abaikan.
    }
  }

  const mic = p.tracks.find((t) => t.source === TrackSource.MICROPHONE);
  const camera = p.tracks.find((t) => t.source === TrackSource.CAMERA);
  const screen = p.tracks.find((t) => t.source === TrackSource.SCREEN_SHARE);

  return {
    userId: p.identity,
    name: p.name || p.identity,
    image,
    isMicMuted: !mic || mic.muted,
    isCameraOn: Boolean(camera && !camera.muted),
    isScreenSharing: Boolean(screen && !screen.muted),
  };
}

/**
 * Snapshot peserta semua voice channel di satu ruangan, langsung dari LiveKit
 * (tanpa mirror DB — LiveKit adalah source of truth, self-healing saat poll
 * berikutnya).
 */
export async function listVoiceParticipants(
  roomId: string,
): Promise<VoiceParticipantsByChannel> {
  const config = readVoiceConfig();
  if (!config) return {};

  const service = getRoomService(config);
  const prefix = `${VOICE_ROOM_PREFIX}:${roomId}:`;
  const rooms = await service.listRooms();
  const voiceRooms = rooms.filter(
    (room) => room.name.startsWith(prefix) && room.numParticipants > 0,
  );

  const result: VoiceParticipantsByChannel = {};
  await Promise.all(
    voiceRooms.map(async (room) => {
      const parsed = parseVoiceRoomName(room.name);
      if (!parsed) return;
      const participants = await service.listParticipants(room.name);
      if (participants.length === 0) return;
      result[parsed.channelId] = participants.map(toParticipantView);
    }),
  );
  return result;
}
