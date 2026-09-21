import { describe, expect, it } from "vitest";
import { pickControlAccount } from "./finance-control-accounts";

const acc = (id: string, code: string) => ({ id, code });

describe("pickControlAccount", () => {
  it("satu akun ber-flag → dipakai walau kodenya sudah di-rename", () => {
    expect(pickControlAccount("AP", [acc("a", "2-1000")], null).id).toBe("a");
  });

  it("CoA standar menghasilkan akun yang sama dengan perilaku lama", () => {
    expect(pickControlAccount("AP", [acc("a", "2000")], null).id).toBe("a");
    expect(pickControlAccount("AR", [acc("r", "1200")], null).id).toBe("r");
  });

  it("beberapa akun ber-flag → kode bawaan menang", () => {
    const picked = pickControlAccount("AP", [acc("x", "2050"), acc("a", "2000")], null);
    expect(picked.id).toBe("a");
  });

  it("beberapa akun ber-flag tanpa kode bawaan → ditolak, tidak menebak", () => {
    expect(() =>
      pickControlAccount("AR", [acc("x", "1210"), acc("y", "1220")], null),
    ).toThrow(/Sisakan satu/);
  });

  it("flag belum terisi → jatuh ke kode bawaan", () => {
    expect(pickControlAccount("AP", [], acc("a", "2000")).id).toBe("a");
  });

  it("tidak ada sama sekali → error yang menjelaskan cara memperbaiki", () => {
    expect(() => pickControlAccount("AP", [], null)).toThrow(/Tandai satu akun/);
  });
});
