import type { Metadata } from "next";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { requirePageSession } from "@/lib/auth";

export const metadata: Metadata = { title: { default: "Dashboard", template: "%s · Potatoni Dashboard" } };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePageSession("ADMIN");
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <DashboardNav name={session.name} />
      <main className="mx-auto w-full max-w-[1200px] min-w-0 px-4 py-5 md:px-8 md:py-8 print:max-w-none print:p-0">{children}</main>
    </div>
  );
}
