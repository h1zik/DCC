import Image from "next/image";
import { cn } from "@/lib/utils";

export type RoomMemberAvatarUser = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
};

function initialFrom(user: RoomMemberAvatarUser): string {
  const label = user.name?.trim() || user.email;
  return label.slice(0, 1).toUpperCase() || "?";
}

/**
 * Foto profil anggota ruangan (overlap ring) untuk kartu ringkasan ruangan.
 */
export function RoomMemberAvatarStack({
  users,
  maxVisible = 6,
  className,
}: {
  users: RoomMemberAvatarUser[];
  maxVisible?: number;
  className?: string;
}) {
  const unique = [...new Map(users.map((u) => [u.id, u])).values()].sort(
    (a, b) =>
      (a.name ?? a.email).localeCompare(b.name ?? b.email, "id", {
        sensitivity: "base",
      }),
  );
  const shown = unique.slice(0, maxVisible);
  const extra = unique.length - shown.length;

  if (unique.length === 0) {
    return (
      <p className="text-muted-foreground text-xs">
        Belum ada anggota ruangan.
      </p>
    );
  }

  const names = unique.map((u) => u.name?.trim() || u.email).join(", ");

  return (
    <div
      className={cn("flex flex-wrap items-center gap-2", className)}
      aria-label={`Anggota terlibat: ${names}`}
    >
      <div className="flex shrink-0 -space-x-2">
        {shown.map((u, i) => {
          const label = u.name?.trim() || u.email;
          return (
            <div
              key={u.id}
              className="ring-background relative inline-flex size-9 rounded-full ring-2"
              style={{ zIndex: shown.length - i }}
              title={label}
            >
              {u.image ? (
                <Image
                  src={u.image}
                  alt={label}
                  width={36}
                  height={36}
                  unoptimized
                  className="border-border size-9 rounded-full border object-cover"
                />
              ) : (
                <span
                  className="border-border bg-muted text-muted-foreground flex size-9 items-center justify-center rounded-full border text-xs font-semibold"
                  aria-hidden
                >
                  {initialFrom(u)}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {extra > 0 ? (
        <span className="text-muted-foreground text-xs font-medium">
          +{extra}
        </span>
      ) : null}
    </div>
  );
}
