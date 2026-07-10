import { describe, expect, it } from "vitest";
import {
  detectCustomBackgroundKind,
  validateDotLottie,
  validateLottieJson,
  validateMp4,
} from "./custom-background-upload";

describe("custom-background-upload", () => {
  it("detects image, video, lottie json, and dotlottie", () => {
    expect(
      detectCustomBackgroundKind(
        new File([""], "bg.webp", { type: "image/webp" }),
      ),
    ).toBe("image");
    expect(
      detectCustomBackgroundKind(
        new File([""], "loop.mp4", { type: "video/mp4" }),
      ),
    ).toBe("video-mp4");
    expect(
      detectCustomBackgroundKind(
        new File([""], "anim.json", { type: "application/json" }),
      ),
    ).toBe("lottie-json");
    expect(
      detectCustomBackgroundKind(
        new File([""], "anim.lottie", { type: "application/octet-stream" }),
      ),
    ).toBe("lottie-dot");
  });

  it("validates lottie json structure", () => {
    const body = validateLottieJson(
      Buffer.from(JSON.stringify({ v: "5.7.4", layers: [] })),
    );
    expect(body.layers).toEqual([]);
  });

  it("rejects invalid lottie json", () => {
    expect(() =>
      validateLottieJson(Buffer.from(JSON.stringify({ foo: 1 }))),
    ).toThrow(/lottie/i);
  });

  it("validates dotlottie zip header", () => {
    expect(() =>
      validateDotLottie(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00])),
    ).not.toThrow();
    expect(() => validateDotLottie(Buffer.from("nope"))).toThrow(/tidak valid/i);
  });

  it("validates mp4 ftyp header", () => {
    const mp4 = Buffer.alloc(16);
    mp4.writeUInt32BE(16, 0);
    mp4.write("ftyp", 4);
    expect(() => validateMp4(mp4)).not.toThrow();
    expect(() => validateMp4(Buffer.from("not-mp4"))).toThrow(/mp4/i);
  });
});
