import { PosHeader } from "@/components/pos/pos-header";
import { requirePageSession } from "@/lib/auth";

export default async function PosLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePageSession();
  return (
    <div className="flex min-h-dvh flex-col">
      <PosHeader name={session.name} role={session.role} />
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 pt-4 pb-28 md:px-6 lg:pb-8">
        {children}
      </main>
    </div>
  );
}
