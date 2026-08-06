import { describe, expect, it } from "vitest";
import { UserRole } from "./user-role";
import {
  canAccessLab,
  canAccessLabBrandHub,
  canAccessLabContentStudio,
  canAccessLabResearchHub,
  canAccessLabSeo,
} from "./roles";
import { isAdministratorAppRoute } from "./routes";

const LAB_GUARDS = [
  ["shell Lab", canAccessLab],
  ["Brand & Creative Hub", canAccessLabBrandHub],
  ["Research Hub", canAccessLabResearchHub],
  ["SEO Toolkit", canAccessLabSeo],
  ["Content Studio", canAccessLabContentStudio],
] as const;

describe("akses Dominatus Lab", () => {
  it.each(LAB_GUARDS)("membuka %s untuk Administrator", (_label, guard) => {
    expect(guard(UserRole.ADMINISTRATOR)).toBe(true);
  });

  it.each(LAB_GUARDS)("menolak %s tanpa peran", (_label, guard) => {
    expect(guard(undefined)).toBe(false);
  });

  it("tidak mengubah akses peran fungsional yang sudah ada", () => {
    // Project Manager = Brand Manager: semua modul.
    expect(canAccessLabBrandHub(UserRole.PROJECT_MANAGER)).toBe(true);
    expect(canAccessLabResearchHub(UserRole.MARKET_ANALYST)).toBe(true);
    expect(canAccessLabSeo(UserRole.MARKET_ANALYST)).toBe(true);
    expect(canAccessLabContentStudio(UserRole.NORMAL_USER)).toBe(true);

    // Market Analyst & tim studio tetap tidak boleh masuk Brand Hub.
    expect(canAccessLabBrandHub(UserRole.MARKET_ANALYST)).toBe(false);
    expect(canAccessLabBrandHub(UserRole.NORMAL_USER)).toBe(false);
    // Tim studio tetap tidak boleh masuk Research Hub / SEO.
    expect(canAccessLabResearchHub(UserRole.NORMAL_USER)).toBe(false);
    expect(canAccessLabSeo(UserRole.NORMAL_USER)).toBe(false);
  });

  it("menolak peran di luar Lab", () => {
    for (const role of [
      UserRole.CEO,
      UserRole.FINANCE,
      UserRole.LOGISTICS,
    ] as const) {
      expect(canAccessLab(role)).toBe(false);
      expect(canAccessLabBrandHub(role)).toBe(false);
      expect(canAccessLabResearchHub(role)).toBe(false);
      expect(canAccessLabSeo(role)).toBe(false);
      expect(canAccessLabContentStudio(role)).toBe(false);
    }
  });
});

describe("isAdministratorAppRoute", () => {
  it("melewatkan seluruh rute Dominatus Lab", () => {
    for (const pathname of [
      "/dominatus-lab",
      "/brand-hub",
      "/brand-hub/influencer-audit",
      "/research-hub/competitor-tracker",
      "/seo/rank-tracker",
      "/content-studio/ideas",
    ]) {
      expect(isAdministratorAppRoute(pathname)).toBe(true);
    }
  });

  it("tetap menolak rute di luar wewenang administrator", () => {
    expect(isAdministratorAppRoute("/finance")).toBe(false);
    expect(isAdministratorAppRoute("/inventory")).toBe(false);
  });
});
