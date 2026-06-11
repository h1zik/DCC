"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { User } from "@prisma/client";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export type CommentMentionUser = Pick<User, "id" | "name" | "email">;

function mentionLabel(user: CommentMentionUser) {
  return user.name?.trim() || user.email;
}

function resolveAssigneeFromText(
  text: string,
  users: CommentMentionUser[],
): string {
  let found = "";
  let earliest = Number.POSITIVE_INFINITY;
  for (const user of users) {
    const label = mentionLabel(user);
    const token = `@${label}`;
    const idx = text.indexOf(token);
    if (idx >= 0 && idx < earliest) {
      earliest = idx;
      found = user.id;
    }
  }
  return found;
}

type MentionState = {
  query: string;
  start: number;
};

export function CommentMentionInput({
  value,
  onChange,
  assigneeId,
  onAssigneeChange,
  users,
  onSubmit,
  pending,
  placeholder,
  autoFocus,
  minRows = 2,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  assigneeId: string;
  onAssigneeChange: (userId: string) => void;
  users: CommentMentionUser[];
  onSubmit: () => void;
  pending: boolean;
  placeholder: string;
  autoFocus?: boolean;
  minRows?: number;
  className?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mention, setMention] = useState<MentionState | null>(null);
  const [highlightIdx, setHighlightIdx] = useState(0);

  const mentionCandidates = useMemo(() => {
    if (!mention) return [];
    const q = mention.query.trim().toLowerCase();
    return users
      .filter((u) => {
        const label = mentionLabel(u).toLowerCase();
        const email = u.email.toLowerCase();
        if (!q) return true;
        return label.includes(q) || email.includes(q);
      })
      .slice(0, 8);
  }, [mention, users]);

  const syncAssignee = useCallback(
    (text: string) => {
      const resolved = resolveAssigneeFromText(text, users);
      if (resolved !== assigneeId) onAssigneeChange(resolved);
    },
    [assigneeId, onAssigneeChange, users],
  );

  const detectMention = useCallback(
    (text: string, caret: number) => {
      const before = text.slice(0, caret);
      const at = before.lastIndexOf("@");
      if (at < 0) {
        setMention(null);
        return;
      }
      const fragment = before.slice(at + 1);
      if (fragment.includes(" ") || fragment.includes("\n")) {
        setMention(null);
        return;
      }
      setMention({ query: fragment, start: at });
      setHighlightIdx(0);
    },
    [],
  );

  const insertMention = useCallback(
    (user: CommentMentionUser) => {
      const el = textareaRef.current;
      if (!el || !mention) return;
      const label = mentionLabel(user);
      const before = value.slice(0, mention.start);
      const after = value.slice(el.selectionStart);
      const next = `${before}@${label} ${after}`;
      onChange(next);
      onAssigneeChange(user.id);
      setMention(null);
      requestAnimationFrame(() => {
        const pos = before.length + label.length + 2;
        el.focus();
        el.setSelectionRange(pos, pos);
      });
    },
    [mention, onAssigneeChange, onChange, value],
  );

  const onTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    onChange(next);
    syncAssignee(next);
    detectMention(next, e.target.selectionStart);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mention && mentionCandidates.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIdx((i) => (i + 1) % mentionCandidates.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIdx(
          (i) => (i - 1 + mentionCandidates.length) % mentionCandidates.length,
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(mentionCandidates[highlightIdx]!);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMention(null);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!pending && value.trim()) onSubmit();
    }
  };

  const onClick = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    detectMention(value, e.currentTarget.selectionStart);
  };

  const onSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    detectMention(value, e.currentTarget.selectionStart);
  };

  return (
    <div className={cn("relative", className)}>
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={onTextChange}
        onKeyDown={onKeyDown}
        onClick={onClick}
        onSelect={onSelect}
        placeholder={placeholder}
        rows={minRows}
        autoFocus={autoFocus}
        disabled={pending}
        className="min-h-0 resize-none pb-9 pr-10 text-sm"
      />
      <Button
        type="button"
        size="icon-sm"
        variant="default"
        className="absolute right-1.5 bottom-1.5 shadow-sm"
        disabled={pending || !value.trim()}
        onClick={onSubmit}
        aria-label="Kirim komentar"
      >
        <Send className="size-3.5" />
      </Button>

      {mention && mentionCandidates.length > 0 ? (
        <ul
          data-anchored-selection-popover
          className="border-border bg-popover absolute right-0 left-0 z-20 max-h-40 overflow-y-auto rounded-md border py-1 shadow-md"
          style={{ bottom: "calc(100% + 4px)" }}
          role="listbox"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {mentionCandidates.map((user, idx) => (
            <li key={user.id} role="option" aria-selected={idx === highlightIdx}>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs",
                  idx === highlightIdx
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-muted",
                )}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  insertMention(user);
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                <span className="text-primary font-medium">@</span>
                <span className="min-w-0 truncate font-medium">
                  {mentionLabel(user)}
                </span>
                {user.name ? (
                  <span className="text-muted-foreground ml-auto truncate text-[10px]">
                    {user.email}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : mention ? (
        <p
          className="text-muted-foreground bg-popover border-border absolute right-0 left-0 z-20 rounded-md border px-2.5 py-1.5 text-[10px] shadow-md"
          style={{ bottom: "calc(100% + 4px)" }}
        >
          Ketik nama untuk menandai anggota ruangan
        </p>
      ) : null}
    </div>
  );
}
