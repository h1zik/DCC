import { Lock } from "lucide-react";
import { PageHero, PageHeroChip } from "@/components/page-hero";
import { PersonalTabs } from "./personal-tabs";

/**
 * Shell Space Pribadi — ruangan privat per user. Halaman anak WAJIB
 * mem-filter semua query dengan `ownerId` dari `requirePersonalOwnerId()`.
 */
export default function PersonalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4 p-4 sm:p-6">
      <PageHero
        variant="compact"
        icon={Lock}
        title="Space Pribadi"
        subtitle="Ruangan pribadimu — hanya kamu yang bisa melihat isinya, termasuk dari admin."
        right={
          <PageHeroChip>
            <Lock className="size-3" />
            Privat
          </PageHeroChip>
        }
      />
      <PersonalTabs />
      <div>{children}</div>
    </div>
  );
}
