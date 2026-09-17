import { KitchenHeader } from "@/components/kitchen/kitchen-header";
import { requirePageSession } from "@/lib/auth";

export default async function KitchenLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePageSession(["ADMIN", "KITCHEN"]);
  return (
    <div className="flex min-h-dvh flex-col">
      <KitchenHeader name={session.name} />
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 pt-4 pb-10 md:px-6">{children}</main>
    </div>
  );
}
