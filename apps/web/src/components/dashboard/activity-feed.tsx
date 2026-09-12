"use client";

import { useState } from "react";
import useSWRInfinite from "swr/infinite";
import { EmptyState, Panel } from "@/components/ui/brand";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "./common";

export type ActivityView = {
  id: string;
  action: string;
  message: string;
  source: "POS" | "DASHBOARD" | "PUBLIC";
  createdAt: string;
  actor: { name: string; role: string } | null;
};

type Page = { activities: ActivityView[]; nextCursor: string | null };

const ACTION_ICON: Record<string, string> = {
  order: "🧾",
  purchase: "🛒",
  product: "🍟",
  location: "📍",
  voucher: "🎟️",
  invite: "✉️",
  customer: "💌",
  modifier: "🧂",
  user: "👤",
  auth: "🔑",
  media: "🖼️",
};

const SOURCES = [
  { value: "", label: "Everything" },
  { value: "POS", label: "Register" },
  { value: "DASHBOARD", label: "Dashboard" },
];
const ACTIONS = [
  { value: "", label: "All actions" },
  { value: "order.", label: "Orders" },
  { value: "purchase.", label: "Purchases" },
  { value: "product.", label: "Products" },
  { value: "modifier.", label: "Add-ons" },
  { value: "location.", label: "Locations" },
  { value: "voucher.", label: "Vouchers" },
  { value: "invite.", label: "Invites" },
  { value: "auth.", label: "Sign-ins" },
];

export function ActivityFeed({ initial, initialCursor }: { initial: ActivityView[]; initialCursor: string | null }) {
  const [source, setSource] = useState("");
  const [action, setAction] = useState("");
  const unfiltered = !source && !action;

  const { data, size, setSize, isValidating, mutate } = useSWRInfinite<Page>(
    (index, previous: Page | null) => {
      if (previous && !previous.nextCursor) return null;
      const params = new URLSearchParams();
      if (source) params.set("source", source);
      if (action) params.set("action", action);
      if (index > 0 && previous?.nextCursor) params.set("cursor", previous.nextCursor);
      const qs = params.toString();
      return `/api/admin/activity${qs ? `?${qs}` : ""}`;
    },
    {
      fallbackData: unfiltered ? [{ activities: initial, nextCursor: initialCursor }] : undefined,
      refreshInterval: 30_000,
    },
  );

  const items = data?.flatMap((p) => p.activities) ?? [];
  const hasMore = Boolean(data?.at(-1)?.nextCursor);
  const loadingMore = isValidating && size > (data?.length ?? 0);

  const chip = (active: boolean) =>
    cn(
      "shrink-0 rounded-full border-2 border-navy px-3 py-1 font-display text-sm font-bold outline-none focus-visible:ring-4 focus-visible:ring-sun/70 pointer-coarse:min-h-11 transition-[background-color,color,transform] duration-160 ease-out-strong active:scale-[0.97]",
      active ? "bg-navy text-cream" : "bg-paper hover:bg-cream-deep",
    );

  return (
    <>
      <PageHeader
        title="Activity"
        description="Every sale, payment, cancellation, purchase and menu change — from the register and the dashboard."
        actions={
          <Button intent="outline" size="sm" onClick={() => mutate()} disabled={isValidating}>
            {isValidating ? "Refreshing…" : "Refresh"}
          </Button>
        }
      />
      <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
        {SOURCES.map((s) => (
          <button key={s.value} type="button" className={chip(source === s.value)} onClick={() => setSource(s.value)}>
            {s.label}
          </button>
        ))}
      </div>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {ACTIONS.map((a) => (
          <button key={a.value} type="button" className={chip(action === a.value)} onClick={() => setAction(a.value)}>
            {a.label}
          </button>
        ))}
      </div>

      {items.length === 0 && !isValidating ? (
        <EmptyState title="No activity yet" />
      ) : (
        <Panel className="divide-y-2 divide-dotted divide-navy/15">
          {items.map((a) => (
            <div key={a.id} className="flex items-start gap-3 px-4 py-3">
              <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-cream text-lg">
                {ACTION_ICON[a.action.split(".")[0] ?? ""] ?? "•"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{a.message}</p>
                <p className="text-xs font-bold text-navy-soft">
                  {formatDateTime(a.createdAt)} · {a.actor?.name ?? "Deleted user"}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-extrabold uppercase",
                  a.source === "POS"
                    ? "bg-sun text-navy"
                    : a.source === "PUBLIC"
                      ? "bg-leaf text-paper"
                      : "bg-navy text-cream",
                )}
              >
                {a.source === "POS" ? "Register" : a.source === "PUBLIC" ? "Customer" : "Dashboard"}
              </span>
            </div>
          ))}
        </Panel>
      )}

      {hasMore && (
        <div className="mt-4 flex justify-center">
          <Button intent="outline" onClick={() => setSize(size + 1)} disabled={loadingMore}>
            {loadingMore ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </>
  );
}
