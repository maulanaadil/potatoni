"use client";

import { cn } from "@/lib/cn";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "@/components/ui/brand";
import { buttonVariants } from "@/components/ui/button";
import { api } from "@/lib/client";

const LINKS = [
  { href: "/dashboard", label: "Overview", icon: "📊" },
  { href: "/dashboard/orders", label: "Orders", icon: "🧾" },
  { href: "/dashboard/products", label: "Products", icon: "🍟" },
  { href: "/dashboard/modifiers", label: "Seasonings & add-ons", icon: "🧂" },
  { href: "/dashboard/locations", label: "Locations", icon: "📍" },
  { href: "/dashboard/purchases", label: "Purchases", icon: "🛒" },
  { href: "/dashboard/activity", label: "Activity", icon: "⚡" },
  { href: "/dashboard/users", label: "Team", icon: "👥" },
];

export function DashboardNav({ name }: { name: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const isActive = (href: string) => (href === "/dashboard" ? pathname === href : pathname.startsWith(href));

  async function signOut() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
    router.refresh();
  }

  const linkClass = (active: boolean) =>
    cn(
      "flex items-center gap-2.5 rounded-xl px-3 py-2 font-display font-bold whitespace-nowrap outline-none transition-[background-color,color,transform] duration-160 ease-out-strong focus-visible:ring-4 focus-visible:ring-sun/70 active:scale-[0.97] pointer-coarse:min-h-11",
      active ? "bg-navy text-cream" : "text-navy hover:bg-navy/5",
    );

  return (
    <>
      {/* Laptop: sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r-2 border-navy bg-paper px-4 py-5 lg:flex">
        <Link href="/dashboard">
          <Logo priority className="h-auto w-full" />
        </Link>
        <nav className="flex flex-col gap-1">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={linkClass(isActive(link.href))}>
              <span aria-hidden>{link.icon}</span>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-2">
          <Link href="/" className={buttonVariants({ intent: "sun" })}>
            Open register
          </Link>
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="truncate text-sm font-extrabold">{name}</span>
            <button type="button" onClick={signOut} className="text-sm font-bold text-navy-soft hover:text-navy">
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Phone & tablet: top bar with scrollable tabs */}
      <header className="sticky top-0 z-30 border-b-2 border-navy bg-cream/90 pt-[env(safe-area-inset-top)] backdrop-blur-md lg:hidden">
        <div className="flex items-center gap-3 px-4 py-2">
          <Link href="/dashboard" className="shrink-0">
            <Logo priority className="h-10 w-auto" />
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/" className={buttonVariants({ intent: "sun", size: "sm" })}>
              Register
            </Link>
            <button type="button" onClick={signOut} className={buttonVariants({ intent: "ghost", size: "sm" })}>
              Sign out
            </button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={cn(linkClass(isActive(link.href)), "text-sm")}>
              <span aria-hidden>{link.icon}</span>
              {link.label}
            </Link>
          ))}
        </nav>
      </header>
    </>
  );
}
