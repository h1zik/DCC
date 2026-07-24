"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { displayName, type UserPick } from "./schedule-types";

/** Pemilih peserta: pencarian, checkbox app, chip terpilih, aksi cepat. */
export function ParticipantPicker({
  users,
  currentUserId,
  selectedIds,
  onChange,
  disabled = false,
}: {
  users: UserPick[];
  currentUserId: string;
  selectedIds: Set<string>;
  onChange: (next: Set<string>) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const label = displayName(u).toLowerCase();
      return label.includes(q) || u.email.toLowerCase().includes(q);
    });
  }, [users, query]);

  const selectedUsers = users.filter((u) => selectedIds.has(u.id));

  function toggle(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label>Peserta</Label>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={disabled}
            onClick={() => onChange(new Set([currentUserId]))}
          >
            Hanya saya
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={disabled}
            onClick={() => onChange(new Set(users.map((u) => u.id)))}
          >
            Pilih semua
          </Button>
        </div>
      </div>
      {selectedUsers.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {selectedUsers.map((u) => (
            <Badge key={u.id} variant="secondary" className="gap-1 pr-1">
              <span className="max-w-[10rem] truncate">{displayName(u)}</span>
              <button
                type="button"
                aria-label={`Hapus ${displayName(u)} dari peserta`}
                disabled={disabled}
                onClick={() => toggle(u.id)}
                className="rounded-full transition-colors hover:text-foreground disabled:pointer-events-none"
              >
                <X className="size-3" aria-hidden />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
      <Input
        placeholder="Cari nama atau email…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        disabled={disabled}
        className="text-sm"
      />
      <ScrollArea className="h-44 rounded-md border border-border p-2">
        <ul className="space-y-1">
          {filtered.map((u) => (
            <li
              key={u.id}
              className="flex items-start gap-2 rounded-md px-1 py-1 text-sm transition-colors hover:bg-muted/50"
            >
              <Checkbox
                id={`pp-${u.id}`}
                checked={selectedIds.has(u.id)}
                onCheckedChange={() => toggle(u.id)}
                disabled={disabled}
                className="mt-0.5"
              />
              <Label
                htmlFor={`pp-${u.id}`}
                className="min-w-0 flex-1 cursor-pointer flex-col items-start gap-0 leading-snug font-normal"
              >
                <span className="block font-medium">{displayName(u)}</span>
                {u.name?.trim() ? (
                  <span className="text-muted-foreground block text-xs">
                    {u.email}
                  </span>
                ) : null}
              </Label>
            </li>
          ))}
          {filtered.length === 0 ? (
            <li className="text-muted-foreground px-1 py-2 text-xs">
              Tidak ada pengguna yang cocok.
            </li>
          ) : null}
        </ul>
      </ScrollArea>
      <p className="text-muted-foreground text-xs">
        Peserta menerima notifikasi H-1 dan ±1 jam sebelum mulai.
      </p>
    </div>
  );
}
