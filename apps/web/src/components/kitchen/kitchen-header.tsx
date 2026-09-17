"use client";

import { useRouter } from "next/navigation";
import { PushAlerts } from "@/components/push-alerts";
import { Logo } from "@/components/ui/brand";
import { buttonVariants } from "@/components/ui/button";
import { api } from "@/lib/client";

export function KitchenHeader({ name }: { name: string }) {
  const router = useRouter();

  async function signOut() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 border-b-2 border-navy bg-cream/90 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-2 md:px-6">
        <Logo priority className="h-11 w-auto md:h-12" />
        <p className="font-display text-lg font-extrabold">Kitchen</p>
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden text-right leading-tight sm:block">
            <p className="text-sm font-extrabold">{name}</p>
            <p className="text-xs font-bold text-navy-soft uppercase">Kitchen</p>
          </div>
          <PushAlerts />
          <button type="button" onClick={signOut} className={buttonVariants({ intent: "ghost", size: "sm" })}>
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
