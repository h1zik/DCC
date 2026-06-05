import { NextResponse } from "next/server";

export function aiApiOk<T>(data: T, role?: string) {
  return NextResponse.json({
    ok: true,
    data,
    meta: {
      generatedAt: new Date().toISOString(),
      source: "dcc-railway",
      ...(role ? { role } : {}),
    },
  });
}

export function aiApiError(
  message: string,
  status: number,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
      ...(extra ?? {}),
    },
    { status },
  );
}
