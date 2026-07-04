"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

export function AgentMessageContent({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p className="whitespace-pre-wrap leading-relaxed">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc space-y-1 pl-5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal space-y-1 pl-5">{children}</ol>
          ),
          li: ({ children }) => <li className="min-w-0">{children}</li>,
          strong: ({ children }) => (
            <strong className="font-semibold">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2"
            >
              {children}
            </a>
          ),
          h1: ({ children }) => (
            <p className="text-base font-semibold">{children}</p>
          ),
          h2: ({ children }) => (
            <p className="text-base font-semibold">{children}</p>
          ),
          h3: ({ children }) => (
            <p className="text-sm font-semibold">{children}</p>
          ),
          code: ({ children, className: codeClassName }) => {
            const isBlock = codeClassName?.includes("language-");
            if (isBlock) {
              return (
                <code className="block overflow-x-auto font-mono text-[0.85em]">
                  {children}
                </code>
              );
            }
            return (
              <code className="bg-muted/60 rounded px-1 py-0.5 font-mono text-[0.92em]">
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="bg-muted/60 overflow-x-auto rounded-md p-3">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-border bg-muted/40 border px-2 py-1.5 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-border border px-2 py-1.5 align-top">
              {children}
            </td>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-border text-muted-foreground border-l-2 pl-3">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="border-border" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
