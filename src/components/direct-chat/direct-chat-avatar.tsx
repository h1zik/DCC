import Image from "next/image";
import { directChatAuthorInitial } from "@/lib/direct-chat-format";
import { cn } from "@/lib/utils";

export function DirectChatAvatar({
  name,
  email,
  image,
  size,
  online = false,
  className,
}: {
  name: string | null;
  email: string;
  image: string | null;
  /** Sisi avatar dalam px. */
  size: number;
  online?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
    >
      {image ? (
        <Image
          src={image}
          alt=""
          width={size}
          height={size}
          className="border-border size-full rounded-full border object-cover"
          unoptimized
        />
      ) : (
        <div
          className="border-border bg-accent/40 text-accent-foreground flex size-full items-center justify-center rounded-full border font-semibold"
          style={{ fontSize: Math.round(size * 0.36) }}
          aria-hidden
        >
          {directChatAuthorInitial(name, email)}
        </div>
      )}
      {online ? (
        <span
          className="border-card absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 bg-emerald-500"
          aria-hidden
        />
      ) : null}
    </div>
  );
}
