"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

type Phase = "shown" | "press" | "leave" | "gone";

// Picks up where the OS launch screen (public/splash) leaves off: same first frame, then a
// press-and-release of the icon and a fade-out. Only visible in the installed app (CSS
// display-mode: standalone), so browser tabs and in-app navigations never see it.
export function LaunchSplash() {
  const [phase, setPhase] = useState<Phase>("shown");

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase("press"), 16),
      setTimeout(() => setPhase("leave"), 156),
      setTimeout(() => setPhase("gone"), 456),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  if (phase === "gone") return null;

  return (
    <div
      aria-hidden
      className={cn(
        "fixed inset-0 z-[100] hidden place-items-center bg-cream transition-opacity duration-300 ease-out-strong print:hidden [@media(display-mode:standalone)]:grid",
        phase === "leave" && "pointer-events-none opacity-0",
      )}
    >
      <Image
        src="/icon.svg"
        alt=""
        width={512}
        height={512}
        priority
        unoptimized
        className={cn(
          "size-[28vmin] transition-[scale,opacity] ease-out-strong motion-reduce:scale-100",
          phase === "press" && "scale-[0.96] duration-140",
          phase === "leave" && "scale-[1.06] opacity-0 duration-240",
        )}
      />
    </div>
  );
}
