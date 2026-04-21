import path from "node:path";

/**
 * Root directory that contains `rooms/`, `tasks/`, `avatars/`, etc.
 * (i.e. the `public/uploads` folder in the repo layout.)
 */
export function getUploadPublicDir(): string {
  const fromEnv = process.env.UPLOAD_PUBLIC_DIR?.trim();
  if (fromEnv) {
    return path.resolve(/* turbopackIgnore: true */ fromEnv);
  }
  const railwayMount = process.env.RAILWAY_VOLUME_MOUNT_PATH?.trim();
  if (railwayMount) {
    return path.resolve(
      path.join(/* turbopackIgnore: true */ railwayMount, "uploads"),
    );
  }
  if (process.env.NODE_ENV === "production" && process.env.RAILWAY_ENVIRONMENT) {
    // Railway default mount point for persistent volumes.
    return "/data/uploads";
  }
  return path.join(
    /* turbopackIgnore: true */ process.cwd(),
    "public",
    "uploads",
  );
}

/** Map `/uploads/...` URL to absolute file path, or null if not under uploads. */
export function absolutePathFromStoredPublicPath(publicPath: string): string | null {
  if (!publicPath.startsWith("/uploads/")) return null;
  const segs = publicPath.split("/").filter(Boolean).slice(1);
  return path.join(getUploadPublicDir(), ...segs);
}

/** Resolve a safe absolute path for GET /uploads/... segments (no `..`). */
export function resolveUploadFileFromUrlSegments(segments: string[]): string | null {
  if (!segments.length) return null;
  if (segments.some((s) => s === ".." || s === "")) return null;
  const base = path.resolve(getUploadPublicDir());
  const resolved = path.resolve(base, ...segments);
  const rel = path.relative(base, resolved);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return resolved;
}
