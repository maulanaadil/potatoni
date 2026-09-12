"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Drawer } from "@base-ui/react/drawer";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ElementType, type ReactNode, useRef, useState } from "react";
import { sheetBackdropClass, sheetHandle, sheetPopupClass, sheetSlide } from "@/components/ui/dialog";
import { useAssistant, useAssistantSession } from "@/lib/assistant";
import { cn } from "@/lib/cn";
import { useMediaQuery } from "@/lib/use-media-query";
import { AssistantComposer, AssistantHistory, AssistantThread } from "./assistant-chat";

const iconButton =
  "grid size-10 shrink-0 place-items-center rounded-full text-xl outline-none transition-[background-color,transform] duration-160 ease-out-strong hover:bg-navy/5 focus-visible:ring-4 focus-visible:ring-sun/70 active:scale-[0.97] motion-reduce:active:scale-100 aria-pressed:bg-navy aria-pressed:text-cream";

const scrollArea = "min-h-0 flex-1 touch-auto overflow-y-auto overscroll-contain";

/**
 * The assistant on every dashboard page: a launcher in the bottom-right corner that opens a
 * floating chat panel (md+) or a bottom sheet (phones), with the owner's chat history one tap
 * away. It shares the open chat with the full Assistant page, and a question keeps running
 * while the panel is closed.
 */
export function AssistantWidget({ name }: { name: string }) {
  const pathname = usePathname();
  const wide = useMediaQuery("(min-width: 48rem)");
  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const launcher = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  useAssistantSession(open && !showHistory);
  const busy = useAssistant((s) => s.pendingSince !== null);
  const unread = useAssistant((s) => s.unread);

  // The full page already is the chat.
  if (pathname.startsWith("/dashboard/assistant")) return null;

  const header = (Title: ElementType, Close: ElementType) => (
    <PanelHeader
      title={<Title className="font-display text-xl leading-tight font-extrabold">Assistant</Title>}
      close={
        <Close aria-label="Close" className={iconButton}>
          ×
        </Close>
      }
      showHistory={showHistory}
      onToggleHistory={() => setShowHistory((v) => !v)}
      onNavigate={() => setOpen(false)}
      dragZone={!wide}
    />
  );

  // Swapping chat ↔ history fades (200ms) so the panel's content doesn't just jump.
  const content = (Scroll: ElementType, composerClass: string) =>
    showHistory ? (
      <Scroll key="history" className={cn(scrollArea, "animate-fade p-3")}>
        <AssistantHistory onPick={() => setShowHistory(false)} />
      </Scroll>
    ) : (
      <>
        <Scroll key="chat" className={cn(scrollArea, "animate-fade")}>
          <AssistantThread name={name} compact className="px-4 py-4" />
        </Scroll>
        <AssistantComposer inputRef={input} className={composerClass} />
      </>
    );

  return (
    <>
      <button
        ref={launcher}
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={open ? "Close the assistant" : "Ask the assistant"}
        className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex h-14 items-center gap-2 rounded-full border-2 border-navy bg-sun px-4 font-display text-lg font-extrabold text-navy shadow-[0_12px_24px_-8px_rgb(42_38_112/0.45)] outline-none transition-[transform,background-color] duration-160 ease-out-strong hover:bg-sun-deep focus-visible:ring-4 focus-visible:ring-sun/70 active:scale-[0.97] motion-reduce:active:scale-100 md:right-6 md:bottom-6 md:pr-5 print:hidden"
      >
        {/* Sparkle ↔ × crossfade (state indication); a 2px blur hides the double exposure. */}
        <span aria-hidden className="grid size-6 place-items-center">
          <SparkleIcon
            className={cn(
              "col-start-1 row-start-1 size-6 transition-[opacity,scale,filter] duration-200 ease-out-strong",
              open && "scale-75 opacity-0 blur-[2px]",
            )}
          />
          <span
            className={cn(
              "col-start-1 row-start-1 text-2xl leading-none transition-[opacity,scale,filter] duration-200 ease-out-strong",
              !open && "scale-75 opacity-0 blur-[2px]",
            )}
          >
            ×
          </span>
        </span>
        <span className="max-md:sr-only">Assistant</span>
        {!open && (busy || unread) && (
          <span
            className={cn(
              "absolute -top-0.5 -right-0.5 size-4 rounded-full border-2 border-paper transition-[opacity,scale] duration-200 ease-out-strong starting:scale-90 starting:opacity-0",
              unread ? "bg-tomato" : "animate-pulse bg-navy-soft motion-reduce:animate-none",
            )}
          >
            <span className="sr-only">{unread ? "New answer" : "Working on your question"}</span>
          </span>
        )}
      </button>

      {wide ? (
        // Non-modal: no scrim, the dashboard stays usable; clicking outside doesn't close it.
        <Dialog.Root open={open} onOpenChange={setOpen} modal={false} disablePointerDismissal>
          <Dialog.Portal>
            <Dialog.Popup
              initialFocus={input}
              finalFocus={launcher}
              className={cn(
                "fixed right-6 bottom-24 z-40 flex h-[min(42rem,calc(100dvh-8rem))] w-[min(27rem,calc(100vw-3rem))] origin-bottom-right flex-col overflow-hidden rounded-3xl border-2 border-navy bg-paper text-navy shadow-[0_24px_48px_-12px_rgb(42_38_112/0.35)] outline-none print:hidden",
                // Grows out of the launcher: opacity + scale(0.95), 200ms in / 140ms out; reduced motion fades.
                "transition-[opacity,scale] duration-200 ease-out-strong data-ending-style:duration-140 data-starting-style:opacity-0 data-ending-style:opacity-0 motion-safe:data-starting-style:scale-95 motion-safe:data-ending-style:scale-95",
              )}
            >
              {header(Dialog.Title, Dialog.Close)}
              {content("div", "shrink-0 border-t-2 border-navy/10 bg-cream/60 p-3")}
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      ) : (
        // Phones: the same swipeable sheet as every other sheet in the app.
        <Drawer.Root open={open} onOpenChange={setOpen}>
          <Drawer.VirtualKeyboardProvider>
            <Drawer.Portal>
              <Drawer.Backdrop forceRender className={sheetBackdropClass} />
              <Drawer.Viewport className="fixed inset-0 z-50 flex items-end justify-center">
                <Drawer.Popup finalFocus={launcher} className={cn(sheetPopupClass, sheetSlide, "h-[calc(88dvh+3rem)]")}>
                  {sheetHandle}
                  {header(Drawer.Title, Drawer.Close)}
                  {content(
                    Drawer.Content,
                    "shrink-0 border-t-2 border-navy/10 bg-cream/60 px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]",
                  )}
                </Drawer.Popup>
              </Drawer.Viewport>
            </Drawer.Portal>
          </Drawer.VirtualKeyboardProvider>
        </Drawer.Root>
      )}
    </>
  );
}

function PanelHeader({
  title,
  close,
  showHistory,
  onToggleHistory,
  onNavigate,
  dragZone,
}: {
  title: ReactNode;
  close: ReactNode;
  showHistory: boolean;
  onToggleHistory: () => void;
  onNavigate: () => void;
  dragZone: boolean;
}) {
  return (
    // On phones the header is the sheet's drag zone.
    <div
      className={cn(
        "flex shrink-0 items-center gap-1 border-b-2 border-navy/10 py-2 pr-2 pl-4",
        dragZone && "touch-none select-none",
      )}
    >
      <span
        aria-hidden
        className="mr-1 grid size-9 shrink-0 place-items-center rounded-full border-2 border-navy bg-sun"
      >
        <SparkleIcon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        {title}
        <p className="truncate text-xs font-bold text-navy-soft">Answers from your shop's data</p>
      </div>
      <button
        type="button"
        aria-pressed={showHistory}
        aria-label="Chat history"
        title="Chat history"
        onClick={onToggleHistory}
        className={iconButton}
      >
        <svg viewBox="0 0 24 24" aria-hidden className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" strokeLinecap="round" />
          <path d="M3 4v4h4M12 7.5V12l3 2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <Link
        href="/dashboard/assistant"
        onClick={onNavigate}
        aria-label="Open full page"
        title="Open full page"
        className={iconButton}
      >
        ⤢
      </Link>
      {close}
    </div>
  );
}

/** Navy sparkle (the ✨ emoji is yellow and disappears on the sun-colored launcher). */
function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M10 2c.8 5.2 2.8 7.2 8 8-5.2.8-7.2 2.8-8 8-.8-5.2-2.8-7.2-8-8 5.2-.8 7.2-2.8 8-8Z" />
      <path d="M19 15c.4 2.2 1.3 3.1 3.5 3.5-2.2.4-3.1 1.3-3.5 3.5-.4-2.2-1.3-3.1-3.5-3.5 2.2-.4 3.1-1.3 3.5-3.5Z" />
    </svg>
  );
}
