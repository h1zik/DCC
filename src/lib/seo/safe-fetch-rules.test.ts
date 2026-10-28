import { describe, expect, it } from "vitest";
import {
  checkPublicUrlSyntax,
  isBlockedHostname,
  isPrivateIp,
  isPrivateIpv4,
  isPrivateIpv6,
} from "./safe-fetch-rules";

describe("safe-fetch-rules", () => {
  it("menolak IPv4 privat/khusus dan menerima publik", () => {
    for (const ip of [
      "127.0.0.1",
      "10.1.2.3",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "224.0.0.1",
    ]) {
      expect(isPrivateIpv4(ip), ip).toBe(true);
    }
    for (const ip of ["8.8.8.8", "172.32.0.1", "104.21.5.6", "1.1.1.1"]) {
      expect(isPrivateIpv4(ip), ip).toBe(false);
    }
  });

  it("menolak IPv6 loopback/ULA/link-local/IPv4-mapped privat", () => {
    expect(isPrivateIpv6("::1")).toBe(true);
    expect(isPrivateIpv6("fd12:3456::1")).toBe(true);
    expect(isPrivateIpv6("fe80::1%eth0")).toBe(true);
    expect(isPrivateIpv6("::ffff:127.0.0.1")).toBe(true);
    expect(isPrivateIpv6("::ffff:7f00:1")).toBe(true);
    expect(isPrivateIpv6("2606:4700::1111")).toBe(false);
    expect(isPrivateIp("2606:4700::1111")).toBe(false);
  });

  it("memblokir hostname internal", () => {
    expect(isBlockedHostname("localhost")).toBe(true);
    expect(isBlockedHostname("api.localhost")).toBe(true);
    expect(isBlockedHostname("db.railway.internal")).toBe(true);
    expect(isBlockedHostname("printer.local")).toBe(true);
    expect(isBlockedHostname("dominatuscenter.com")).toBe(false);
    expect(isBlockedHostname("localhost.dominatuscenter.com")).toBe(false);
  });

  it("checkPublicUrlSyntax: skema, kredensial, IP literal", () => {
    expect(checkPublicUrlSyntax("https://example.com/a").ok).toBe(true);
    expect(checkPublicUrlSyntax("ftp://example.com").ok).toBe(false);
    expect(checkPublicUrlSyntax("http://user:pw@example.com").ok).toBe(false);
    expect(checkPublicUrlSyntax("http://169.254.169.254/latest/").ok).toBe(false);
    expect(checkPublicUrlSyntax("http://[::1]:3000/").ok).toBe(false);
    expect(checkPublicUrlSyntax("http://localhost:3000/").ok).toBe(false);
    expect(checkPublicUrlSyntax("bukan url").ok).toBe(false);
  });
});
