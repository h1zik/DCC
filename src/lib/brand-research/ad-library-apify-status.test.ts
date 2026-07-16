import { describe, expect, it } from "vitest";
import { getAdLibraryApifyOutcome } from "./ad-library-apify-status";

describe("getAdLibraryApifyOutcome", () => {
  it.each(["READY", "RUNNING", "TIMING-OUT", "ABORTING", "UNKNOWN"])(
    "keeps %s waiting instead of reporting a false failure",
    (status) => {
      expect(getAdLibraryApifyOutcome(status)).toBe("waiting");
    },
  );

  it("recognizes a completed run", () => {
    expect(getAdLibraryApifyOutcome("SUCCEEDED")).toBe("succeeded");
  });

  it.each(["FAILED", "ABORTED", "TIMED-OUT"])(
    "recognizes terminal failure %s",
    (status) => {
      expect(getAdLibraryApifyOutcome(status)).toBe("failed");
    },
  );
});
