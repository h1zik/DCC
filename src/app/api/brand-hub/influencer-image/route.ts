import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isProxyableImageHost } from "@/lib/brand-research/influencer/image-proxy";

/**
 * Meneruskan gambar CDN Instagram/TikTok ke browser.
 *
 * CDN Instagram menolak permintaan langsung dari halaman kita, sehingga foto
 * profil dan thumbnail post tampil kosong. Pengambilan dari server tidak
 * terkena pembatasan itu.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 12 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;

/**
 * CDN memberi respons berbeda untuk klien yang tidak menyerupai browser.
 */
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  }
  if (session.user.role !== UserRole.PROJECT_MANAGER) {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  const target = new URL(req.url).searchParams.get("url");
  if (!target) {
    return NextResponse.json({ error: "Parameter url wajib." }, { status: 400 });
  }
  // Penjaga SSRF: hanya host CDN sosial media yang boleh diambil.
  if (!isProxyableImageHost(target)) {
    return NextResponse.json(
      { error: "Host gambar tidak diizinkan." },
      { status: 400 },
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
      // Jangan kirim referer — justru itu yang membuat CDN menolak.
      referrerPolicy: "no-referrer",
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { error: "Gagal mengambil gambar dari CDN." },
      { status: 502 },
    );
  }

  if (!upstream.ok || !upstream.body) {
    // URL CDN Instagram bertanda tangan dan kedaluwarsa dalam hitungan hari,
    // jadi 403/404 di sini wajar untuk audit lama. UI menampilkan inisial.
    return NextResponse.json(
      { error: `CDN menolak (${upstream.status}).` },
      { status: upstream.status === 404 ? 404 : 502 },
    );
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) {
    return NextResponse.json(
      { error: "Respons bukan gambar." },
      { status: 415 },
    );
  }

  const length = Number(upstream.headers.get("content-length") ?? "0");
  if (Number.isFinite(length) && length > MAX_BYTES) {
    return NextResponse.json({ error: "Gambar terlalu besar." }, { status: 413 });
  }

  const buffer = await upstream.arrayBuffer();
  if (buffer.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "Gambar terlalu besar." }, { status: 413 });
  }

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(buffer.byteLength),
      // Privat: gambar hanya untuk pengguna yang sudah login.
      "Cache-Control": "private, max-age=3600",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
