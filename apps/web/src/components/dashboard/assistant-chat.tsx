"use client";

import { cn } from "@/lib/cn";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Panel, Sparkles } from "@/components/ui/brand";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { api } from "@/lib/client";
import { PageHeader } from "./common";

type Message = { role: "user" | "assistant"; content: string; tools?: string[] };

const SUGGESTIONS = [
  "How are sales going, and what should we do to sell more this week?",
  "What's our next bazaar in Bandung, and how should we prepare for it?",
  "Which add-ons and upsells should cashiers push to raise the average ticket?",
  "Plan a voucher campaign for our next event.",
];

const TOOL_LABELS: Record<string, string> = {
  get_business_overview: "overview",
  get_sales_report: "sales",
  get_product_performance: "best sellers",
  get_locations: "locations",
  get_costs: "purchases",
  get_voucher_performance: "vouchers",
  get_customer_insights: "customers",
  search_web: "web search",
};

export function AssistantChat({ name }: { name: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length === 0) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    bottom.current?.scrollIntoView({ block: "end", behavior: reduce ? "auto" : "smooth" });
  }, [messages.length, busy]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const history = messages;
    const next: Message[] = [...history, { role: "user", content }];
    setMessages(next);
    setDraft("");
    setBusy(true);
    try {
      const { reply, tools } = await api<{ reply: string; tools: string[] }>("/api/admin/assistant", {
        body: { messages: next.map(({ role, content }) => ({ role, content })) },
      });
      setMessages([...next, { role: "assistant", content: reply, tools }]);
    } catch (err) {
      toast.error((err as Error).message);
      // Put the question back so it can be sent again.
      setMessages(history);
      setDraft(content);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Assistant"
        description="Your marketing and sales sidekick. It reads the register's data (sales, menu, locations, vouchers, purchases) and suggests how to sell more."
        actions={
          messages.length > 0 && (
            <Button intent="outline" size="sm" onClick={() => setMessages([])} disabled={busy}>
              New chat
            </Button>
          )
        }
      />

      <Panel className="flex min-h-[60dvh] flex-col">
        <div className="flex-1 space-y-4 px-4 py-5 md:px-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <Sparkles className="h-10 text-navy/50" />
              <div>
                <p className="font-display text-2xl font-extrabold">Hi {name.split(" ")[0]}, what should we work on?</p>
                <p className="mt-1 text-sm font-semibold text-navy-soft">
                  Ask about sales, best sellers, the next event, promos — in English or Bahasa Indonesia.
                </p>
              </div>
              <div className="grid w-full max-w-2xl gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="rounded-2xl border-2 border-navy/20 bg-cream px-4 py-3 text-left text-sm font-bold outline-none transition-[border-color,background-color,transform] duration-160 ease-out-strong hover:border-navy hover:bg-cream-deep focus-visible:ring-4 focus-visible:ring-sun/70 active:scale-[0.97] motion-reduce:active:scale-100"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => <Bubble key={i} message={m} />)
          )}
          {busy && (
            <div className="flex animate-rise items-center gap-2 text-sm font-bold text-navy-soft" role="status">
              <span className="size-2 animate-pulse rounded-full bg-sun motion-reduce:animate-none" />
              Checking the numbers…
            </div>
          )}
          <div ref={bottom} />
        </div>

        <form
          className="sticky bottom-0 flex items-end gap-2 rounded-b-3xl border-t-2 border-navy bg-paper p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          onSubmit={(e) => {
            e.preventDefault();
            void send(draft);
          }}
        >
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter adds a line (skip while an IME is composing).
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void send(draft);
              }
            }}
            placeholder="Ask the assistant…"
            rows={1}
            maxLength={4000}
            aria-label="Message"
            className="max-h-40 min-h-11 resize-none"
          />
          <Button type="submit" intent="sun" disabled={busy || !draft.trim()}>
            Send
          </Button>
        </form>
      </Panel>
    </>
  );
}

function Bubble({ message }: { message: Message }) {
  const mine = message.role === "user";
  const checked = message.tools?.map((t) => TOOL_LABELS[t] ?? t);
  return (
    <div className={cn("flex animate-rise", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[min(42rem,90%)] rounded-3xl px-4 py-3",
          mine ? "rounded-br-lg bg-navy text-cream" : "rounded-bl-lg border-2 border-navy/15 bg-cream",
        )}
      >
        {mine ? <p className="font-semibold whitespace-pre-wrap">{message.content}</p> : <Markdown text={message.content} />}
        {checked && checked.length > 0 && (
          <p className="mt-2 text-xs font-bold text-navy-soft">Checked: {checked.join(", ")}</p>
        )}
      </div>
    </div>
  );
}

/**
 * Just enough Markdown for the assistant's replies (the prompt asks for no tables/code):
 * headings, bullet and numbered lists, paragraphs, **bold**, *italic*, `code` and links.
 * Builds React elements, never HTML strings.
 */
function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) blocks.push(<p key={blocks.length}>{inline(paragraph.join(" "))}</p>);
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag key={blocks.length} className={cn("space-y-1 pl-5", list.ordered ? "list-decimal" : "list-disc")}>
        {list.items.map((item, i) => (
          <li key={i}>{inline(item)}</li>
        ))}
      </Tag>,
    );
    list = null;
  };

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const heading = line.match(/^#{1,4}\s+(.*)$/);
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    const numbered = line.match(/^\d+[.)]\s+(.*)$/);

    // Blank lines and "---" dividers both just end the current block.
    if (!line || /^([-*_])\1{2,}$/.test(line)) {
      flushParagraph();
      flushList();
    } else if (heading) {
      flushParagraph();
      flushList();
      blocks.push(
        <p key={blocks.length} className="font-display text-lg font-extrabold">
          {inline(heading[1] ?? "")}
        </p>,
      );
    } else if (bullet || numbered) {
      flushParagraph();
      const ordered = Boolean(numbered);
      if (list && list.ordered !== ordered) flushList();
      list ??= { ordered, items: [] };
      list.items.push((bullet ?? numbered)?.[1] ?? "");
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushList();

  return <div className="space-y-2.5 leading-relaxed">{blocks}</div>;
}

const INLINE = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;

function inline(text: string): ReactNode {
  return text.split(INLINE).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="rounded bg-navy/10 px-1 text-[0.9em]">
          {part.slice(1, -1)}
        </code>
      );
    }
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
    if (link) {
      return (
        <a key={i} href={link[2]} target="_blank" rel="noopener noreferrer" className="font-bold underline underline-offset-2">
          {link[1]}
        </a>
      );
    }
    if (part.length > 2 && part.startsWith("*") && part.endsWith("*")) return <em key={i}>{part.slice(1, -1)}</em>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}
