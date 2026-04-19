import { UserRole } from "@prisma/client";
import { auth } from "@/lib/auth";
import {
  isAdministratorAppRoute,
  isCeoAppRoute,
  isLogisticsRoute,
  isProfileRoute,
  isStudioWorkspaceRoute,
} from "@/lib/routes";
import { isStudioOrProjectManager } from "@/lib/roles";
import { NextResponse } from "next/server";

function defaultHomeForRole(role: UserRole | undefined): string {
  if (role === UserRole.CEO) return "/";
  if (role === UserRole.ADMINISTRATOR) return "/rooms";
  if (isStudioOrProjectManager(role)) return "/tasks";
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

  if (isProfileRoute(pathname)) {
    return NextResponse.next();
  }

  if (role === UserRole.CEO) {
    if (!isCeoAppRoute(pathname)) {
      return NextResponse.redirect(new URL("/", req.nextUrl));
    }
  }

  if (role === UserRole.ADMINISTRATOR) {
    if (pathname === "/") {
      return NextResponse.redirect(new URL("/rooms", req.nextUrl));
    }
    if (!isAdministratorAppRoute(pathname)) {
      return NextResponse.redirect(new URL("/rooms", req.nextUrl));
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

  if (isStudioOrProjectManager(role)) {
    if (pathname === "/") {
      return NextResponse.redirect(new URL("/tasks", req.nextUrl));
    }
    if (!isStudioWorkspaceRoute(pathname)) {
      return NextResponse.redirect(new URL("/tasks", req.nextUrl));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
