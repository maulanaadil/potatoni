"use client";

import { cn } from "@/lib/cn";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "@/components/ui/brand";
import { buttonVariants } from "@/components/ui/button";
import { api } from "@/lib/client";

const NAV = [
  { href: "/", label: "Register", icon: "🍟" },
  { href: "/orders", label: "Orders", icon: "🧾" },
  { href: "/purchases", label: "Purchases", icon: "🛒" },
];

export function PosHeader({ name, role }: { name: string; role: "ADMIN" | "CASHIER" }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
    router.refresh();
  }

  const nav = (
    <nav className="flex gap-1 rounded-2xl border-2 border-navy bg-paper p-1">
      {NAV.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 font-display text-sm font-bold whitespace-nowrap outline-none transition-[background-color,color,transform] duration-160 ease-out-strong focus-visible:ring-4 focus-visible:ring-sun/70 active:scale-[0.97] pointer-coarse:min-h-11 md:flex-none md:px-4 md:text-base",
              active ? "bg-navy text-cream" : "text-navy hover:bg-navy/5",
            )}
          >
            <span aria-hidden>{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <header className="sticky top-0 z-30 border-b-2 border-navy bg-cream/90 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-2 md:px-6">
        <Link href="/" className="shrink-0">
          <Logo priority className="h-11 w-auto md:h-12" />
        </Link>
        <div className="hidden flex-1 justify-center md:flex">{nav}</div>
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden text-right leading-tight lg:block">
            <p className="text-sm font-extrabold">{name}</p>
            <p className="text-xs font-bold text-navy-soft uppercase">{role === "ADMIN" ? "Owner" : "Cashier"}</p>
          </div>
          {role === "ADMIN" && (
            <Link href="/dashboard" className={buttonVariants({ intent: "sun", size: "sm" })}>
              Dashboard
            </Link>
          )}
          <button
            type="button"
            onClick={signOut}
            className={buttonVariants({ intent: "ghost", size: "sm" })}
          >
            Sign out
          </button>
        </div>
      </div>
      <div className="px-4 pb-2 md:hidden">{nav}</div>
    </header>
  );
}
