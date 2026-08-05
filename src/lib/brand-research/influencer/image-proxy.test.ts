import { describe, expect, it } from "vitest";
import {
  influencerImageSrc,
  isProxyableImageHost,
} from "@/lib/brand-research/influencer/image-proxy";

describe("isProxyableImageHost", () => {
  it("accepts Instagram and Meta CDN hosts", () => {
    expect(
      isProxyableImageHost("https://scontent-sin6-1.cdninstagram.com/v/t51.jpg"),
    ).toBe(true);
    expect(isProxyableImageHost("https://scontent.fbcdn.net/v/t51.jpg")).toBe(true);
  });

  it("accepts TikTok CDN hosts", () => {
    expect(isProxyableImageHost("https://p16-sign.tiktokcdn.com/x.jpeg")).toBe(true);
    expect(isProxyableImageHost("https://p77-sign.tiktokcdn-us.com/x.jpeg")).toBe(
      true,
    );
  });

  it("rejects anything outside the allowlist", () => {
    // Ini penjaga SSRF — tanpa itu proxy bisa dipakai membaca jaringan internal.
    expect(isProxyableImageHost("https://example.com/x.jpg")).toBe(false);
    expect(isProxyableImageHost("http://169.254.169.254/latest/meta-data")).toBe(
      false,
    );
    expect(isProxyableImageHost("https://localhost/x.jpg")).toBe(false);
    expect(isProxyableImageHost("https://192.168.1.1/x.jpg")).toBe(false);
  });

  it("rejects non-https and malformed urls", () => {
    expect(isProxyableImageHost("http://scontent.cdninstagram.com/x.jpg")).toBe(
      false,
    );
    expect(isProxyableImageHost("not a url")).toBe(false);
    expect(isProxyableImageHost("")).toBe(false);
  });

  it("is not fooled by a lookalike domain", () => {
    expect(isProxyableImageHost("https://cdninstagram.com.evil.test/x.jpg")).toBe(
      false,
    );
    expect(isProxyableImageHost("https://evilcdninstagram.com/x.jpg")).toBe(false);
  });
});

describe("influencerImageSrc", () => {
  it("routes CDN images through the proxy", () => {
    const src = influencerImageSrc("https://scontent.cdninstagram.com/a.jpg?x=1");
    expect(src).toBe(
      "/api/brand-hub/influencer-image?url=https%3A%2F%2Fscontent.cdninstagram.com%2Fa.jpg%3Fx%3D1",
    );
  });

  it("leaves unknown hosts untouched rather than breaking them", () => {
    expect(influencerImageSrc("https://example.com/a.jpg")).toBe(
      "https://example.com/a.jpg",
    );
  });

  it("returns null when there is no image", () => {
    expect(influencerImageSrc(null)).toBeNull();
    expect(influencerImageSrc(undefined)).toBeNull();
    expect(influencerImageSrc("")).toBeNull();
  });
});
