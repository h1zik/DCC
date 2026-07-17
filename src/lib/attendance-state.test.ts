import { describe, expect, it } from "vitest";
import { getLatestAttendanceSession } from "./attendance-state";

const event = (
  id: string,
  type: "CHECK_IN" | "CHECK_OUT" | "SICK" | "PERMISSION",
  minute: number,
) => ({
  id,
  type,
  timestamp: new Date(
    `2026-07-17T${String(minute).padStart(2, "0")}:00:00Z`,
  ),
});

describe("getLatestAttendanceSession", () => {
  it("returns not started when there are no check-in/out events", () => {
    const session = getLatestAttendanceSession([
      event("sick", "SICK", 8),
      event("permission", "PERMISSION", 9),
    ]);

    expect(session).toEqual({
      state: "NOT_STARTED",
      checkIn: null,
      checkOut: null,
    });
  });

  it("keeps the second session active after IN, OUT, IN", () => {
    const session = getLatestAttendanceSession([
      event("in-2", "CHECK_IN", 10),
      event("in-1", "CHECK_IN", 8),
      event("out-1", "CHECK_OUT", 9),
    ]);

    expect(session.state).toBe("CHECKED_IN");
    expect(session.checkIn?.id).toBe("in-2");
    expect(session.checkOut).toBeNull();
  });

  it("pairs the latest completed session after IN, OUT, IN, OUT", () => {
    const session = getLatestAttendanceSession([
      event("out-1", "CHECK_OUT", 9),
      event("out-2", "CHECK_OUT", 11),
      event("in-1", "CHECK_IN", 8),
      event("in-2", "CHECK_IN", 10),
    ]);

    expect(session.state).toBe("CHECKED_OUT");
    expect(session.checkIn?.id).toBe("in-2");
    expect(session.checkOut?.id).toBe("out-2");
  });
});
