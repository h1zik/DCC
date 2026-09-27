import { KolHubModuleSidebar } from "@/components/kol-hub/kol-hub-module-sidebar";
import { KolHubSubNav } from "@/components/kol-hub/kol-hub-sub-nav";
import { ensureKolHubPage } from "@/lib/kol/auth";
import { getApprovalCount } from "@/lib/kol/readers";

export default async function KolHubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { access } = await ensureKolHubPage();
  const approvals = await getApprovalCount();

  return (
    // Skin bento global dari lab-theme/lab-bento; hue cobalt khusus KOL Hub.
    <div className="lab-hue-cobalt flex w-full min-w-0 gap-6 lg:gap-8">
      <KolHubModuleSidebar
        className="lg:flex"
        pendingApprovals={approvals.total}
        showBrandHubLinks={access.brandHub}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <KolHubSubNav className="lg:hidden" pendingApprovals={approvals.total} />
        <div className="animate-in fade-in duration-300 motion-reduce:animate-none">
          {children}
        </div>
      </div>
    </div>
  );
}
