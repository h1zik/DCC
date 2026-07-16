"use client";

import type { ReactNode } from "react";
import { ImageIcon, LayoutDashboard, Trophy, UserRound } from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

export function GamificationAdminTabs({
  overview,
  backgrounds,
  avatarFrames,
  achievements,
}: {
  overview: ReactNode;
  backgrounds: ReactNode;
  avatarFrames: ReactNode;
  achievements: ReactNode;
}) {
  return (
    <Tabs defaultValue="overview" className="gap-0">
      <div className="overflow-x-auto border-b border-border/70">
        <TabsList
          variant="line"
          aria-label="Navigasi pengaturan gamifikasi"
          className="h-11 min-w-max justify-start gap-5"
        >
          <TabsTrigger value="overview" className="px-1.5">
            <LayoutDashboard className="size-4" aria-hidden />
            Ringkasan
          </TabsTrigger>
          <TabsTrigger value="backgrounds" className="px-1.5">
            <ImageIcon className="size-4" aria-hidden />
            Background
          </TabsTrigger>
          <TabsTrigger value="frames" className="px-1.5">
            <UserRound className="size-4" aria-hidden />
            Frame avatar
          </TabsTrigger>
          <TabsTrigger value="achievements" className="px-1.5">
            <Trophy className="size-4" aria-hidden />
            Achievement
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="overview" className="pt-6">
        {overview}
      </TabsContent>
      <TabsContent value="backgrounds" className="pt-6">
        {backgrounds}
      </TabsContent>
      <TabsContent value="frames" className="pt-6">
        {avatarFrames}
      </TabsContent>
      <TabsContent value="achievements" className="pt-6">
        {achievements}
      </TabsContent>
    </Tabs>
  );
}
