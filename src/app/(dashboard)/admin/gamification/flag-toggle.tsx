"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setProfileGamificationEnabled } from "@/actions/app-branding";
import { actionErrorMessage } from "@/lib/action-error-message";
import { ToggleSwitch } from "@/components/profile/gamification/toggle-switch";

export function GamificationFlagToggle({
  enabled,
  locked = false,
}: {
  enabled: boolean;
  locked?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [on, setOn] = useState(enabled);

  function handleChange(next: boolean) {
    if (locked || pending) return;
    setOn(next);
    start(async () => {
      try {
        await setProfileGamificationEnabled(next);
        toast.success(
          next ? "Gamifikasi profil dinyalakan." : "Gamifikasi profil dimatikan.",
        );
        router.refresh();
      } catch (e) {
        setOn(!next);
        toast.error(actionErrorMessage(e, "Gagal mengubah pengaturan."));
      }
    });
  }

  return (
    <ToggleSwitch
      checked={on}
      onChange={handleChange}
      disabled={pending || locked}
      label="Aktifkan gamifikasi profil"
    />
  );
}
