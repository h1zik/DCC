"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  clearProfileAvatar,
  updateProfileAvatar,
  updateProfileBasics,
} from "@/actions/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera, User } from "lucide-react";

export function ProfileForm({
  email,
  initialName,
  initialBio,
  initialImage,
}: {
  email: string;
  initialName: string;
  initialBio: string;
  initialImage: string | null;
}) {
  const router = useRouter();
  const { update } = useSession();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(initialName);
  const [bio, setBio] = useState(initialBio);
  const [pendingBasics, startBasics] = useTransition();
  const [pendingAvatar, startAvatar] = useTransition();
  const [pendingClear, startClear] = useTransition();

  async function onSaveBasics() {
    startBasics(async () => {
      try {
        await updateProfileBasics({ name: name.trim() || null, bio: bio.trim() || null });
        await update({
          user: {
            name: name.trim() || null,
            bio: bio.trim() || null,
          },
        });
        toast.success("Profil disimpan.");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Gagal menyimpan.");
      }
    });
  }

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    startAvatar(async () => {
      try {
        const fd = new FormData();
        fd.append("avatar", file);
        const { image } = await updateProfileAvatar(fd);
        await update({ user: { image } });
        toast.success("Foto profil diperbarui.");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Unggah gagal.");
      }
    });
  }

  function onClearAvatar() {
    startClear(async () => {
      try {
        await clearProfileAvatar();
        await update({ user: { image: null } });
        toast.success("Foto profil dihapus.");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Gagal.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Foto profil</CardTitle>
          <CardDescription>JPG, PNG, GIF, atau WebP — maks. 2 MB.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <div className="bg-muted relative size-24 shrink-0 overflow-hidden rounded-full border border-border">
            {initialImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={initialImage}
                alt=""
                className="size-full object-cover"
              />
            ) : (
              <div className="text-muted-foreground flex size-full items-center justify-center">
                <User className="size-10" />
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={onPickAvatar}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pendingAvatar}
              onClick={() => fileRef.current?.click()}
            >
              <Camera className="size-4" />
              {pendingAvatar ? "Mengunggah…" : "Ganti foto"}
            </Button>
            {initialImage ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pendingClear}
                onClick={onClearAvatar}
              >
                Hapus foto
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nama & bio</CardTitle>
          <CardDescription>
            Email tetap <span className="font-mono text-foreground">{email}</span>{" "}
            (login).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="p-name">Nama tampilan</Label>
            <Input
              id="p-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nama di Kanban & chat"
              maxLength={120}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-bio">Bio / deskripsi</Label>
            <Textarea
              id="p-bio"
              rows={5}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Misalnya: pecinta kopi & spreadsheet…"
              maxLength={2000}
            />
            <p className="text-muted-foreground text-xs tabular-nums">
              {bio.length}/2000
            </p>
          </div>
          <Button
            type="button"
            disabled={pendingBasics}
            onClick={() => void onSaveBasics()}
          >
            {pendingBasics ? "Menyimpan…" : "Simpan nama & bio"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
