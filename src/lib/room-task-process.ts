import { RoomTaskProcess } from "@prisma/client";

export const ROOM_TASK_PROCESS_ORDER: RoomTaskProcess[] = [
  RoomTaskProcess.MARKET_RESEARCH,
  RoomTaskProcess.PRODUCT_DEVELOPMENT,
  RoomTaskProcess.BRAND_AND_DESIGN,
  RoomTaskProcess.PANEL_TESTING,
  RoomTaskProcess.PRE_LAUNCH,
  RoomTaskProcess.PRODUCTION,
];

/** Semua fase — dipakai default CEO / seed. */
export const ALL_ROOM_TASK_PROCESSES: RoomTaskProcess[] = [
  ...ROOM_TASK_PROCESS_ORDER,
];

const VALID = new Set<string>(Object.values(RoomTaskProcess));

export function roomTaskProcessLabel(p: RoomTaskProcess): string {
  switch (p) {
    case RoomTaskProcess.MARKET_RESEARCH:
      return "Market Research";
    case RoomTaskProcess.PRODUCT_DEVELOPMENT:
      return "Product Development";
    case RoomTaskProcess.BRAND_AND_DESIGN:
      return "Brand & Design";
    case RoomTaskProcess.PANEL_TESTING:
      return "Panel Testing";
    case RoomTaskProcess.PRE_LAUNCH:
      return "Pre Launch";
    case RoomTaskProcess.PRODUCTION:
      return "Produksi";
    default:
      return p;
  }
}

export function parseRoomTaskProcessParam(
  raw: string | string[] | undefined | null,
): RoomTaskProcess | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v || !VALID.has(v)) return null;
  return v as RoomTaskProcess;
}

export function defaultRoomTaskProcess(): RoomTaskProcess {
  return ROOM_TASK_PROCESS_ORDER[0]!;
}
