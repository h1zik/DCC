import { describe, expect, it } from "vitest";
import { UserRole } from "./user-role";
import {
  canAccessLab,
  canAccessLabBrandHub,
  canAccessLabContentStudio,
  canAccessLabResearchHub,
  canAccessLabSeo,
  hasAdministratorAccess,
} from "./roles";
import { isAdministratorAppRoute, isCeoAppRoute } from "./routes";

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

  it("memberi Logistik akses Lab setara tim studio", () => {
    expect(canAccessLab(UserRole.LOGISTICS)).toBe(true);
    expect(canAccessLabContentStudio(UserRole.LOGISTICS)).toBe(true);
    expect(canAccessLabBrandHub(UserRole.LOGISTICS)).toBe(false);
    expect(canAccessLabResearchHub(UserRole.LOGISTICS)).toBe(false);
    expect(canAccessLabSeo(UserRole.LOGISTICS)).toBe(false);
  });

  // CEO mewarisi seluruh akses Administrator, termasuk semua modul Lab.
  it.each(LAB_GUARDS)("membuka %s untuk CEO", (_label, guard) => {
    expect(guard(UserRole.CEO)).toBe(true);
  });

  it("menolak peran di luar Lab", () => {
    expect(canAccessLab(UserRole.FINANCE)).toBe(false);
    expect(canAccessLabBrandHub(UserRole.FINANCE)).toBe(false);
    expect(canAccessLabResearchHub(UserRole.FINANCE)).toBe(false);
    expect(canAccessLabSeo(UserRole.FINANCE)).toBe(false);
    expect(canAccessLabContentStudio(UserRole.FINANCE)).toBe(false);
  });
});

describe("akses setara Administrator", () => {
  it("hanya Administrator & CEO", () => {
    expect(hasAdministratorAccess(UserRole.ADMINISTRATOR)).toBe(true);
    expect(hasAdministratorAccess(UserRole.CEO)).toBe(true);
    expect(hasAdministratorAccess(UserRole.PROJECT_MANAGER)).toBe(false);
    expect(hasAdministratorAccess(UserRole.FINANCE)).toBe(false);
    expect(hasAdministratorAccess(undefined)).toBe(false);
  });
});

describe("isCeoAppRoute", () => {
  it("mencakup seluruh rute administrator + rute eksekutif CEO", () => {
    for (const pathname of [
      "/",
      "/overdue",
      "/approvals",
      "/home",
      "/brands",
      "/admin/users",
      "/admin/roles",
      "/admin/branding",
      "/admin/gamification",
      "/dominatus-lab",
      "/seo/rank-tracker",
      "/tasks",
      "/room/abc",
    ]) {
      expect(isCeoAppRoute(pathname)).toBe(true);
    }
  });

  it("tetap menolak modul Finance & Logistik", () => {
    expect(isCeoAppRoute("/finance")).toBe(false);
    expect(isCeoAppRoute("/inventory")).toBe(false);
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
