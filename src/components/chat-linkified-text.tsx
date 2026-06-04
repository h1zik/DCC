import { Fragment } from "react";

import { splitLinkifiedText } from "@/lib/linkify-chat-text";
import { cn } from "@/lib/utils";

export function ChatLinkifiedText({
  text,
  className,
  linkClassName,
}: {
  text: string;
  className?: string;
  linkClassName?: string;
}) {
  const segments = splitLinkifiedText(text);

  return (
    <p className={cn("whitespace-pre-wrap break-words", className)}>
      {segments.map((segment, index) =>
        segment.type === "link" ? (
          <a
            key={`link-${index}`}
            href={segment.href}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "font-medium text-blue-600 underline underline-offset-2 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300",
              linkClassName,
            )}
          >
            {segment.value}
          </a>
        ) : (
          <Fragment key={`text-${index}`}>{segment.value}</Fragment>
        ),
      )}
    </p>
  );
}
