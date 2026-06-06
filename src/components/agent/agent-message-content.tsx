"use client";

import { cn } from "@/lib/utils";

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    const key = `${keyPrefix}-${i++}`;
    if (match[2]) {
      nodes.push(
        <strong key={key} className="font-semibold">
          {match[2]}
        </strong>,
      );
    } else if (match[3]) {
      nodes.push(
        <em key={key} className="italic">
          {match[3]}
        </em>,
      );
    } else if (match[4]) {
      nodes.push(
        <code
          key={key}
          className="bg-muted/60 rounded px-1 py-0.5 font-mono text-[0.92em]"
        >
          {match[4]}
        </code>,
      );
    }
    last = match.index + match[0].length;
  }

  if (last < text.length) {
    nodes.push(text.slice(last));
  }

  return nodes;
}

export function AgentMessageContent({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const lines = content.split("\n");

  return (
    <div className={cn("space-y-1", className)}>
      {lines.map((line, index) => {
        const bullet = line.match(/^\s*[-*]\s+(.*)/);
        if (bullet) {
          return (
            <div key={index} className="flex gap-2 pl-0.5">
              <span aria-hidden className="text-muted-foreground shrink-0 select-none">
                •
              </span>
              <span className="min-w-0">{renderInline(bullet[1]!, `b-${index}`)}</span>
            </div>
          );
        }

        const numbered = line.match(/^\s*\d+\.\s+(.*)/);
        if (numbered) {
          return (
            <p key={index} className="pl-0.5">
              {renderInline(numbered[1]!, `n-${index}`)}
            </p>
          );
        }

        if (!line.trim()) {
          return <div key={index} className="h-1.5" aria-hidden />;
        }

        return (
          <p key={index} className="whitespace-pre-wrap">
            {renderInline(line, `p-${index}`)}
          </p>
        );
      })}
    </div>
  );
}
