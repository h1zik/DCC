import { UserRole } from "@prisma/client";
import { auth } from "@/lib/auth";
import {
  isAdministratorAppRoute,
  isCeoAppRoute,
  isChangelogRoute,
  isFinanceAppRoute,
  isLogisticsRoute,
  isMarketAnalystAppRoute,
  isPersonalRoute,
  isProfileRoute,
  isStudioWorkspaceRoute,
} from "@/lib/routes";
import { isMarketAnalyst, isStudioOrProjectManager } from "@/lib/roles";
import { NextResponse } from "next/server";

function defaultHomeForRole(role: UserRole | undefined): string {
  if (role === UserRole.CEO) return "/";
  if (role === UserRole.ADMINISTRATOR) return "/home";
  if (role === UserRole.FINANCE) return "/finance";
  if (isMarketAnalyst(role)) return "/dominatus-lab";
  if (isStudioOrProjectManager(role)) return "/home";
  return "/inventory";
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const role = req.auth?.user?.role as UserRole | undefined;

  if (pathname.startsWith("/login")) {
    if (isLoggedIn) {
      return NextResponse.redirect(
        new URL(defaultHomeForRole(role), req.nextUrl),
      );
    }
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  if (
    isProfileRoute(pathname) ||
    isChangelogRoute(pathname) ||
    isPersonalRoute(pathname)
  ) {
    return NextResponse.next();
  }

  if (role === UserRole.CEO) {
    if (!isCeoAppRoute(pathname)) {
      return NextResponse.redirect(new URL("/", req.nextUrl));
    }
  }

  if (role === UserRole.ADMINISTRATOR) {
    if (
      pathname === "/" ||
      pathname === "/rooms" ||
      pathname.startsWith("/rooms/")
    ) {
      return NextResponse.redirect(new URL("/home", req.nextUrl));
    }
    if (!isAdministratorAppRoute(pathname)) {
      return NextResponse.redirect(new URL("/home", req.nextUrl));
    }
    return NextResponse.next();
  }

  if (role === UserRole.LOGISTICS) {
    if (pathname === "/") {
      return NextResponse.redirect(new URL("/inventory", req.nextUrl));
    }
    if (!isLogisticsRoute(pathname)) {
      return NextResponse.redirect(new URL("/inventory", req.nextUrl));
    }
  }

  if (role === UserRole.FINANCE) {
    if (pathname === "/") {
      return NextResponse.redirect(new URL("/finance", req.nextUrl));
    }
    if (!isFinanceAppRoute(pathname)) {
      return NextResponse.redirect(new URL("/finance", req.nextUrl));
    }
  }

  if (isMarketAnalyst(role)) {
    if (pathname === "/") {
      return NextResponse.redirect(new URL("/dominatus-lab", req.nextUrl));
    }
    if (!isMarketAnalystAppRoute(pathname)) {
      return NextResponse.redirect(new URL("/dominatus-lab", req.nextUrl));
    }
    return NextResponse.next();
  }

  if (isStudioOrProjectManager(role)) {
    if (pathname === "/") {
      return NextResponse.redirect(new URL("/home", req.nextUrl));
    }
    if (!isStudioWorkspaceRoute(pathname)) {
      return NextResponse.redirect(new URL("/home", req.nextUrl));
    }
  }

  return NextResponse.next();
});

export const config = {
  /**
   * `uploads/` diserahkan ke route handler (bukan file statis build-time).
   * `models/` = bobot model face-api di /public (sebagian file tanpa
   * ekstensi, mis. `tiny_face_detector_model-shard1`) — harus dilewati
   * middleware agar tidak terkena redirect auth saat dimuat browser.
   */
  matcher: [
    "/((?!api/|_next/static|_next/image|favicon.ico|uploads/|models/|.*\\..*).*)",
  ],
};
