import type { Metadata } from "next";
import { AssistantWidget } from "@/components/dashboard/assistant-widget";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { requirePageSession } from "@/lib/auth";

export const metadata: Metadata = { title: { default: "Dashboard", template: "%s · Potatoni Dashboard" } };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePageSession("ADMIN");
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <DashboardNav name={session.name} />
      {/* pb-24: room under the last row for the assistant launcher (hidden on the Assistant page,
          which fills the screen itself) */}
      <main className="mx-auto w-full max-w-[1200px] min-w-0 px-4 pt-5 pb-24 has-[[data-assistant-page]]:pb-5 md:px-8 md:pt-8 md:pb-28 md:has-[[data-assistant-page]]:pb-8 print:max-w-none print:p-0">
        {children}
      </main>
      <AssistantWidget name={session.name} />
    </div>
  );
}
