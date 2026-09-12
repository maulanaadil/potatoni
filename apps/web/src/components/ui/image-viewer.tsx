"use client";

import { Dialog } from "@base-ui/react/dialog";
import Image from "next/image";

const control =
  "grid size-10 place-items-center rounded-full text-xl font-bold outline-none transition-[background-color,transform] duration-160 ease-out-strong hover:bg-navy/5 focus-visible:ring-4 focus-visible:ring-sun/70 active:scale-[0.97] disabled:opacity-30 motion-reduce:active:scale-100 pointer-coarse:size-11";

/**
 * Full-size preview of one or more images (receipts, posters) over a dimmed page.
 * Motion (animate skill → modal): centered, opacity + scale(0.96), 200ms in / 140ms out on the
 * strong ease-out; reduced motion fades only. Moving between images is instant — it's repeated
 * and often keyboard-driven (← →). Click outside, Esc or × to close.
 */
export function ImageViewer({
  urls,
  open,
  index,
  onOpenChange,
  onIndexChange,
}: {
  urls: string[];
  open: boolean;
  index: number;
  onOpenChange: (open: boolean) => void;
  onIndexChange: (index: number) => void;
}) {
  const count = urls.length;
  const current = urls[Math.min(index, count - 1)];
  const step = (delta: number) => onIndexChange((index + delta + count) % count);
  if (!current) return null;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        {/* Above the assistant panel (z-40) and phone sheets (z-50). */}
        <Dialog.Backdrop className="fixed inset-0 z-[60] bg-navy/80 transition-opacity duration-200 ease-out-strong data-ending-style:duration-140 data-starting-style:opacity-0 data-ending-style:opacity-0" />
        <Dialog.Popup
          onKeyDown={(e) => {
            if (count < 2) return;
            if (e.key === "ArrowRight") step(1);
            if (e.key === "ArrowLeft") step(-1);
          }}
          className="fixed top-1/2 left-1/2 z-[60] flex w-[min(94vw,64rem)] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3 outline-none transition-[opacity,scale] duration-200 ease-out-strong data-ending-style:duration-140 data-starting-style:opacity-0 data-ending-style:opacity-0 motion-safe:data-starting-style:scale-[0.96] motion-safe:data-ending-style:scale-[0.96]"
        >
          <Dialog.Title className="sr-only">
            Image {Math.min(index, count - 1) + 1} of {count}
          </Dialog.Title>
          <div className="relative h-[min(78dvh,52rem)] w-full">
            <Image src={current} alt="" fill sizes="94vw" className="object-contain" />
          </div>
          <div className="flex items-center gap-1 rounded-full border-2 border-navy bg-paper px-1.5 py-1 text-navy">
            {count > 1 && (
              <>
                <button type="button" aria-label="Previous image" onClick={() => step(-1)} className={control}>
                  ‹
                </button>
                <span className="min-w-12 text-center text-sm font-bold tabular-nums">
                  {Math.min(index, count - 1) + 1} / {count}
                </span>
                <button type="button" aria-label="Next image" onClick={() => step(1)} className={control}>
                  ›
                </button>
                <span aria-hidden className="mx-1 h-6 w-0.5 rounded-full bg-navy/15" />
              </>
            )}
            <a
              href={current}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full px-3 py-2 text-sm font-bold outline-none transition-[background-color,transform] duration-160 ease-out-strong hover:bg-navy/5 focus-visible:ring-4 focus-visible:ring-sun/70 active:scale-[0.97] motion-reduce:active:scale-100"
            >
              Open original ↗
            </a>
            <Dialog.Close aria-label="Close preview" className={control}>
              ×
            </Dialog.Close>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
