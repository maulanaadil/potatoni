import type { Metadata } from "next";
import { Suspense } from "react";
import { Logo, Sparkles } from "@/components/ui/brand";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

// Seen about once a day per device — the rise/stagger entrance is allowed here.
export default function LoginPage() {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10">
      <Sparkles className="absolute top-10 left-6 h-14 text-navy opacity-70 md:left-16" />
      <Sparkles className="absolute right-6 bottom-12 h-10 rotate-12 text-navy opacity-50 md:right-20" />
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <Logo priority className="h-auto w-72 animate-rise motion-reduce:animate-none" />
        <div className="w-full animate-rise rounded-3xl border-2 border-navy bg-paper p-6 [animation-delay:60ms] motion-reduce:animate-none">
          <h1 className="font-display text-2xl font-extrabold">Sign in</h1>
          <p className="mb-5 text-sm font-semibold text-navy-soft">
            Cashiers go to the register, owners to the dashboard.
          </p>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
        <p className="animate-rise font-display text-sm font-bold tracking-wide text-navy-soft uppercase [animation-delay:120ms] motion-reduce:animate-none">
          Good potato, good mood.
        </p>
      </div>
    </main>
  );
}
