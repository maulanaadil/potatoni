"use client";

import Image from "next/image";
import Link from "next/link";
import { Fragment, type ReactNode, type Ref, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import useSWR, { mutate } from "swr";
import { EmptyState, Panel, Sparkles } from "@/components/ui/brand";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/field";
import { ImageViewer } from "@/components/ui/image-viewer";
import { CHATS_URL, useAssistant, useAssistantSession } from "@/lib/assistant";
import { type AssistantChatSummary, type AssistantMessage, MAX_ASSISTANT_IMAGES } from "@/lib/assistant-types";
import { api } from "@/lib/client";
import { cn } from "@/lib/cn";
import { formatDateTime, mediaUrl } from "@/lib/format";
import { useMediaQuery } from "@/lib/use-media-query";
import { ActionCard } from "./assistant-actions";
import { ConfirmButton, PageHeader } from "./common";

const SUGGESTIONS = [
  "How are sales going, and what should we do to sell more this week?",
  "What's our next bazaar in Bandung, and how should we prepare for it?",
  "Which add-ons and upsells should cashiers push to raise the average ticket?",
  "Plan a voucher campaign for our next event.",
];

const IMAGE_QUESTION = "Here's a photo — read it and fill in what we should record.";

const TOOL_LABELS: Record<string, string> = {
  get_business_overview: "overview",
  get_sales_report: "sales",
  get_product_performance: "best sellers",
  get_locations: "locations",
  get_costs: "purchases",
  get_voucher_performance: "vouchers",
  get_customer_insights: "customers",
  web_search: "web search",
  code_execution: "web search", // web search filters its results with code
};

export function AssistantChat({ name }: { name: string }) {
  useAssistantSession(true);
  const hasMessages = useAssistant((s) => s.messages.length > 0);
  const newChat = useAssistant((s) => s.newChat);
  const wide = useMediaQuery("(min-width: 64rem)");
  const [historyOpen, setHistoryOpen] = useState(false);

  return (
    // Viewport minus the dashboard chrome, so only the thread scrolls and the composer stays in view.
    <div
      data-assistant-page
      className="flex h-[calc(100dvh-9.5rem)] min-h-[26rem] flex-col md:h-[calc(100dvh-11rem)] lg:h-[calc(100dvh-4rem)]"
    >
      <PageHeader
        title="Assistant"
        description="Your marketing and sales sidekick. It reads the register's data, reads photos of receipts and posters, and suggests how to sell more."
        actions={
          <>
            <Link
              href="/dashboard/assistant/instructions"
              className={buttonVariants({ intent: "outline", size: "sm" })}
            >
              Instructions
            </Link>
            <Button intent="outline" size="sm" className="lg:hidden" onClick={() => setHistoryOpen(true)}>
              History
            </Button>
            {hasMessages && (
              <Button intent="outline" size="sm" onClick={newChat}>
                New chat
              </Button>
            )}
          </>
        }
      />
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <Panel className="hidden min-h-0 flex-col overflow-hidden lg:flex">
          <p className="shrink-0 px-4 pt-3 pb-2 font-display text-lg font-extrabold">History</p>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3">
            <AssistantHistory />
          </div>
        </Panel>
        <Panel className="flex min-h-0 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <AssistantThread name={name} className="px-4 py-5 md:px-6" />
          </div>
          <AssistantComposer className="shrink-0 border-t-2 border-navy bg-paper p-3" />
        </Panel>
      </div>
      <Dialog open={historyOpen && !wide} onOpenChange={setHistoryOpen} title="History">
        <AssistantHistory onPick={() => setHistoryOpen(false)} />
      </Dialog>
    </div>
  );
}

export function AssistantHistory({ onPick }: { onPick?: () => void }) {
  const { data, isLoading } = useSWR<{ chats: AssistantChatSummary[] }>(CHATS_URL);
  const chatId = useAssistant((s) => s.chatId);
  const openChat = useAssistant((s) => s.openChat);
  const newChat = useAssistant((s) => s.newChat);
  const forget = useAssistant((s) => s.forget);

  async function remove(id: string) {
    try {
      await api(`${CHATS_URL}/${id}`, { method: "DELETE" });
      forget(id);
      await mutate(CHATS_URL);
      toast.success("Chat deleted");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        intent="sun"
        size="sm"
        onClick={() => {
          newChat();
          onPick?.();
        }}
      >
        + New chat
      </Button>
      {isLoading && !data ? (
        <p className="px-1 py-2 text-sm font-semibold text-navy-soft">Loading chats…</p>
      ) : !data?.chats.length ? (
        <EmptyState title="No chats yet">Your questions and answers are saved here.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-1">
          {data.chats.map((chat) => {
            const current = chat.id === chatId;
            const questions = Math.ceil(chat.messageCount / 2);
            return (
              <li key={chat.id} className={cn("flex items-center gap-1 rounded-2xl", current && "bg-navy/5")}>
                <button
                  type="button"
                  aria-current={current || undefined}
                  onClick={() => {
                    void openChat(chat.id);
                    onPick?.();
                  }}
                  className="min-w-0 flex-1 rounded-2xl px-3 py-2 text-left outline-none transition-[background-color,transform] duration-160 ease-out-strong hover:bg-navy/5 focus-visible:ring-4 focus-visible:ring-sun/70 active:scale-[0.98] motion-reduce:active:scale-100"
                >
                  <p className="truncate font-bold">{chat.title}</p>
                  <p className="text-xs font-semibold text-navy-soft">
                    {formatDateTime(chat.updatedAt)} · {questions} question{questions === 1 ? "" : "s"}
                  </p>
                </button>
                <ConfirmButton onConfirm={() => remove(chat.id)} confirmLabel="Delete?">
                  ×
                </ConfirmButton>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function AssistantThread({
  name,
  compact = false,
  className,
}: {
  name: string;
  compact?: boolean;
  className?: string;
}) {
  const messages = useAssistant((s) => s.messages);
  const pendingSince = useAssistant((s) => s.pendingSince);
  const loading = useAssistant((s) => s.loading);
  const send = useAssistant((s) => s.send);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length === 0 && pendingSince === null) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    bottom.current?.scrollIntoView({ block: "end", behavior: reduce ? "auto" : "smooth" });
  }, [messages.length, pendingSince]);

  if (loading) {
    return <p className={cn("text-sm font-bold text-navy-soft", className)}>Loading chat…</p>;
  }

  // Only the newest form of each kind can be saved, so a corrected proposal never records twice.
  const newestForm = new Map<string, string>();
  for (const m of messages) for (const a of m.actions) newestForm.set(a.type, m.id);

  return (
    <div className={cn("space-y-4", className)}>
      {messages.length === 0 && pendingSince === null ? (
        <div className={cn("flex flex-col items-center text-center", compact ? "gap-3 py-4" : "gap-4 py-8")}>
          <Sparkles className={cn("text-navy/50", compact ? "h-8" : "h-10")} />
          <div>
            <p className={cn("font-display font-extrabold", compact ? "text-xl" : "text-2xl")}>
              Hi {name.split(" ")[0]}, what should we work on?
            </p>
            <p className="mt-1 text-sm font-semibold text-navy-soft">
              Ask about sales, the next event, promos — or send a photo of a receipt to record it.
            </p>
          </div>
          <div className={cn("grid w-full gap-2", compact ? "grid-cols-1" : "max-w-2xl sm:grid-cols-2")}>
            {SUGGESTIONS.map((s, i) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                style={{ animationDelay: `${i * 50}ms` }}
                className="animate-rise rounded-2xl border-2 border-navy/20 bg-cream px-4 py-3 text-left text-sm font-bold outline-none transition-[border-color,background-color,transform] duration-160 ease-out-strong hover:border-navy hover:bg-cream-deep focus-visible:ring-4 focus-visible:ring-sun/70 active:scale-[0.97] motion-reduce:animate-fade motion-reduce:active:scale-100"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        messages.map((m, i) => (
          <Bubble
            key={m.id}
            message={m}
            last={i === messages.length - 1 && pendingSince === null}
            newestForm={newestForm}
          />
        ))
      )}
      {pendingSince !== null && <Pending since={pendingSince} />}
      <div ref={bottom} />
    </div>
  );
}

function Pending({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.max(0, Math.round((now - since) / 1000));

  return (
    <div role="status" className="flex animate-rise flex-col gap-0.5 motion-reduce:animate-fade">
      <p className="flex items-center gap-2 text-sm font-bold text-navy-soft">
        <span aria-hidden className="size-2 animate-pulse rounded-full bg-sun motion-reduce:animate-none" />
        Checking the numbers… <span className="tabular-nums">{seconds}s</span>
      </p>
      {seconds >= 15 && (
        <p className="pl-4 text-xs text-navy-soft">Questions that need a web search can take a minute.</p>
      )}
    </div>
  );
}

function Bubble({
  message,
  last,
  newestForm,
}: {
  message: AssistantMessage;
  last: boolean;
  newestForm: Map<string, string>;
}) {
  const send = useAssistant((s) => s.send);
  const mine = message.role === "user";
  const checked = [...new Set(message.tools?.map((t) => TOOL_LABELS[t] ?? t))];
  const [viewer, setViewer] = useState({ open: false, index: 0 });

  return (
    <div className={cn("flex animate-rise flex-col motion-reduce:animate-fade", mine ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[min(42rem,92%)] rounded-3xl px-4 py-3",
          mine ? "rounded-br-lg bg-navy text-cream" : "w-full rounded-bl-lg border-2 border-navy/15 bg-cream",
        )}
      >
        {message.images?.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {message.images.map((key, index) => (
              <button
                key={key}
                type="button"
                aria-label="Preview image"
                onClick={() => setViewer({ open: true, index })}
                className="relative block size-28 cursor-zoom-in overflow-hidden rounded-2xl border-2 border-cream/30 outline-none transition-transform duration-160 ease-out-strong focus-visible:ring-4 focus-visible:ring-sun/70 active:scale-[0.97] motion-reduce:active:scale-100"
              >
                <Image src={mediaUrl(key) ?? ""} alt="Attached image" fill sizes="112px" className="object-cover" />
              </button>
            ))}
            <ImageViewer
              urls={message.images.map((key) => mediaUrl(key) ?? "")}
              open={viewer.open}
              index={viewer.index}
              onOpenChange={(open) => setViewer((v) => ({ ...v, open }))}
              onIndexChange={(index) => setViewer((v) => ({ ...v, index }))}
            />
          </div>
        )}
        {mine ? (
          <p className="font-semibold whitespace-pre-wrap">{message.content}</p>
        ) : (
          <Markdown text={message.content} />
        )}
        {message.actions?.map((action, index) => (
          <ActionCard
            key={action.type}
            messageId={message.id}
            index={index}
            action={action}
            superseded={newestForm.get(action.type) !== message.id}
          />
        ))}
        {!mine && (
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="min-w-0 text-xs font-bold text-navy-soft">
              {checked.length > 0 && `Checked: ${checked.join(", ")}`}
            </p>
            <CopyButton text={message.content} />
          </div>
        )}
      </div>
      {last && !mine && message.replies?.length > 0 && (
        <div className="mt-2 flex max-w-[min(42rem,92%)] flex-wrap gap-2">
          {message.replies.map((reply, i) => (
            <button
              key={reply}
              type="button"
              onClick={() => send(reply)}
              style={{ animationDelay: `${i * 50}ms` }}
              className="animate-rise rounded-full border-2 border-navy/20 bg-paper px-3 py-1.5 text-left text-sm font-bold outline-none transition-[border-color,background-color,transform] duration-160 ease-out-strong hover:border-navy hover:bg-cream-deep focus-visible:ring-4 focus-visible:ring-sun/70 active:scale-[0.97] motion-reduce:animate-fade motion-reduce:active:scale-100"
            >
              {reply}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <button
      type="button"
      onClick={() =>
        navigator.clipboard.writeText(text).then(
          () => setCopied(true),
          () => toast.error("Couldn't copy the answer"),
        )
      }
      className="shrink-0 rounded-full px-2.5 py-1 text-xs font-bold text-navy-soft outline-none transition-[background-color,transform] duration-160 ease-out-strong hover:bg-navy/5 hover:text-navy focus-visible:ring-4 focus-visible:ring-sun/70 active:scale-[0.97] motion-reduce:active:scale-100"
    >
      {copied ? "Copied ✓" : "Copy"}
    </button>
  );
}

const UPLOADABLE = ["image/png", "image/jpeg", "image/webp"];

// Claude reads images at full detail up to a 1568px long edge; JPEG re-encoding also converts HEIC etc. the upload API refuses.
async function shrinkImage(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1568 / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1.5 * 1024 * 1024 && UPLOADABLE.includes(file.type)) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob ? new File([blob], "photo.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

export function AssistantComposer({
  className,
  inputRef,
}: {
  className?: string;
  inputRef?: Ref<HTMLTextAreaElement>;
}) {
  const draft = useAssistant((s) => s.draft);
  const setDraft = useAssistant((s) => s.setDraft);
  const attachments = useAssistant((s) => s.attachments);
  const setAttachments = useAssistant((s) => s.setAttachments);
  const send = useAssistant((s) => s.send);
  const busy = useAssistant((s) => s.pendingSince !== null);
  const [uploading, setUploading] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const [viewer, setViewer] = useState({ open: false, index: 0 });
  const full = attachments.length + uploading >= MAX_ASSISTANT_IMAGES;

  async function attach(files: File[]) {
    const images = files.filter((f) => f.type.startsWith("image/"));
    const room = Math.max(0, MAX_ASSISTANT_IMAGES - attachments.length - uploading);
    if (images.length > room) toast.error(`Up to ${MAX_ASSISTANT_IMAGES} images per question`);
    await Promise.all(
      images.slice(0, room).map(async (file) => {
        setUploading((n) => n + 1);
        try {
          const body = new FormData();
          body.set("file", await shrinkImage(file));
          body.set("folder", "assistant");
          const { key } = await api<{ key: string }>("/api/admin/uploads", { body });
          setAttachments((keys) => [...keys, key]);
        } catch (err) {
          toast.error((err as Error).message);
        } finally {
          setUploading((n) => n - 1);
        }
      }),
    );
  }

  function submit() {
    if (busy || uploading > 0) return;
    const text = draft.trim() || (attachments.length ? IMAGE_QUESTION : "");
    if (text) void send(text);
  }

  return (
    <form
      className={cn("flex flex-col gap-2", className)}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {(attachments.length > 0 || uploading > 0) && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((key, index) => (
            <div
              key={key}
              className="relative size-16 animate-pop overflow-hidden rounded-xl border-2 border-navy/20 motion-reduce:animate-fade"
            >
              <button
                type="button"
                aria-label="Preview image"
                onClick={() => setViewer({ open: true, index })}
                className="absolute inset-0 cursor-zoom-in outline-none focus-visible:ring-4 focus-visible:ring-sun/70"
              >
                <Image src={mediaUrl(key) ?? ""} alt="Attached image" fill sizes="64px" className="object-cover" />
              </button>
              <button
                type="button"
                aria-label="Remove image"
                onClick={() => setAttachments((keys) => keys.filter((k) => k !== key))}
                className="absolute top-0.5 right-0.5 grid size-6 place-items-center rounded-full bg-navy text-sm text-cream outline-none transition-transform duration-160 ease-out-strong focus-visible:ring-4 focus-visible:ring-sun/70 active:scale-[0.97]"
              >
                ×
              </button>
            </div>
          ))}
          {uploading > 0 && (
            <div className="grid size-16 animate-pulse place-items-center rounded-xl bg-navy/10 text-xs font-bold text-navy-soft motion-reduce:animate-none">
              Uploading…
            </div>
          )}
          <ImageViewer
            urls={attachments.map((key) => mediaUrl(key) ?? "")}
            open={viewer.open && attachments.length > 0}
            index={viewer.index}
            onOpenChange={(open) => setViewer((v) => ({ ...v, open }))}
            onIndexChange={(index) => setViewer((v) => ({ ...v, index }))}
          />
        </div>
      )}
      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={full}
          aria-label="Attach a photo or screenshot"
          title="Attach a photo or screenshot"
          className="grid size-11 shrink-0 place-items-center rounded-xl border-2 border-navy/20 bg-white text-navy outline-none transition-[border-color,transform] duration-160 ease-out-strong hover:border-navy focus-visible:ring-4 focus-visible:ring-sun/70 active:scale-[0.97] disabled:opacity-40 motion-reduce:active:scale-100"
        >
          <svg viewBox="0 0 24 24" aria-hidden className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="16" rx="3" />
            <circle cx="9" cy="10" r="1.8" />
            <path d="m21 16-5-5-8 9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            void attach([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
        <Textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onPaste={(e) => {
            const images = [...e.clipboardData.files].filter((f) => f.type.startsWith("image/"));
            if (images.length) {
              e.preventDefault();
              void attach(images);
            }
          }}
          onKeyDown={(e) => {
            // Enter also confirms IME composition; don't send then.
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Ask, or paste a receipt…"
          rows={1}
          maxLength={4000}
          aria-label="Message"
          className="field-sizing-content max-h-40 min-h-11 resize-none"
        />
        <Button
          type="submit"
          intent="sun"
          disabled={busy || uploading > 0 || (!draft.trim() && attachments.length === 0)}
        >
          Send
        </Button>
      </div>
    </form>
  );
}

// Minimal Markdown (the prompt asks for no tables/code), built as React elements — never HTML strings.
function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; start: number; items: { line: number; text: string }[] } | null = null;
  let paragraph: { start: number; lines: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph) blocks.push(<p key={paragraph.start}>{inline(paragraph.lines.join(" "))}</p>);
    paragraph = null;
  };
  const flushList = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag key={list.start} className={cn("space-y-1 pl-5", list.ordered ? "list-decimal" : "list-disc")}>
        {list.items.map((item) => (
          <li key={item.line}>{inline(item.text)}</li>
        ))}
      </Tag>,
    );
    list = null;
  };

  for (const [lineNo, raw] of text.split("\n").entries()) {
    const line = raw.trim();
    const heading = line.match(/^#{1,4}\s+(.*)$/);
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    const numbered = line.match(/^\d+[.)]\s+(.*)$/);

    // Blank lines and "---" dividers end the current block.
    if (!line || /^([-*_])\1{2,}$/.test(line)) {
      flushParagraph();
      flushList();
    } else if (heading) {
      flushParagraph();
      flushList();
      blocks.push(
        <p key={lineNo} className="font-display text-lg font-extrabold">
          {inline(heading[1] ?? "")}
        </p>,
      );
    } else if (bullet || numbered) {
      flushParagraph();
      const ordered = Boolean(numbered);
      if (list && list.ordered !== ordered) flushList();
      list ??= { ordered, start: lineNo, items: [] };
      list.items.push({ line: lineNo, text: (bullet ?? numbered)?.[1] ?? "" });
    } else {
      flushList();
      paragraph ??= { start: lineNo, lines: [] };
      paragraph.lines.push(line);
    }
  }
  flushParagraph();
  flushList();

  return <div className="space-y-2.5 leading-relaxed">{blocks}</div>;
}

const INLINE = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;

function inline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let offset = 0;
  for (const part of text.split(INLINE)) {
    const key = offset;
    offset += part.length;
    if (part) nodes.push(inlinePart(part, key));
  }
  return nodes;
}

function inlinePart(part: string, key: number): ReactNode {
  if (part.startsWith("**") && part.endsWith("**")) return <strong key={key}>{part.slice(2, -2)}</strong>;
  if (part.startsWith("`") && part.endsWith("`")) {
    return (
      <code key={key} className="rounded bg-navy/10 px-1 text-[0.9em]">
        {part.slice(1, -1)}
      </code>
    );
  }
  const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
  if (link) {
    return (
      <a
        key={key}
        href={link[2]}
        target="_blank"
        rel="noopener noreferrer"
        className="font-bold underline underline-offset-2"
      >
        {link[1]}
      </a>
    );
  }
  if (part.length > 2 && part.startsWith("*") && part.endsWith("*")) return <em key={key}>{part.slice(1, -1)}</em>;
  return <Fragment key={key}>{part}</Fragment>;
}
