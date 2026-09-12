"use client";

import Link from "next/link";
import { QRCodeCanvas } from "qrcode.react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { EmptyState, Panel } from "@/components/ui/brand";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import { DatePicker } from "@/components/ui/date-picker";
import { api } from "@/lib/client";
import { cn } from "@/lib/cn";
import { formatDay, formatRupiah } from "@/lib/format";
import type { CampaignSummary } from "@/lib/services/vouchers";
import { ConfirmButton, PageHeader } from "./common";

type Draft = {
  id?: string;
  name: string;
  description: string;
  discountType: "PERCENT" | "AMOUNT";
  discountValue: string;
  maxDiscount: string;
  minSpend: string;
  claimStartsAt: string;
  claimEndsAt: string;
  validDays: string;
  quota: string;
  isActive: boolean;
};

const blank: Draft = {
  name: "",
  description: "",
  discountType: "PERCENT",
  discountValue: "20",
  maxDiscount: "",
  minSpend: "",
  claimStartsAt: "",
  claimEndsAt: "",
  validDays: "30",
  quota: "",
  isActive: true,
};

const STATE: Record<CampaignSummary["state"], { label: string; className: string }> = {
  open: { label: "Claiming open", className: "bg-leaf text-paper" },
  "not-started": { label: "Not started", className: "bg-sun text-navy" },
  ended: { label: "Ended", className: "bg-navy/10 text-navy-soft" },
  "sold-out": { label: "All claimed", className: "bg-navy text-cream" },
  inactive: { label: "Off", className: "bg-navy/10 text-navy-soft" },
};

const digits = (v: string) => v.replace(/\D/g, "");
const numOrNull = (v: string) => (digits(v) ? Number(digits(v)) : null);

export function VoucherManager({ campaigns: initial, baseUrl }: { campaigns: CampaignSummary[]; baseUrl: string }) {
  const { data, mutate } = useSWR<{ campaigns: CampaignSummary[] }>("/api/admin/vouchers", {
    fallbackData: { campaigns: initial },
    refreshInterval: 60_000,
  });
  const campaigns = data?.campaigns ?? initial;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const isLocal = /localhost|127\.0\.0\.1/.test(baseUrl);

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      await api(draft.id ? `/api/admin/vouchers/${draft.id}` : "/api/admin/vouchers", {
        method: draft.id ? "PATCH" : "POST",
        body: {
          name: draft.name,
          description: draft.description,
          discountType: draft.discountType,
          discountValue: Number(digits(draft.discountValue)),
          maxDiscount: draft.discountType === "PERCENT" ? numOrNull(draft.maxDiscount) : null,
          minSpend: numOrNull(draft.minSpend) ?? 0,
          claimStartsAt: draft.claimStartsAt || null,
          claimEndsAt: draft.claimEndsAt || null,
          validDays: Number(digits(draft.validDays)) || 30,
          quota: numOrNull(draft.quota),
          isActive: draft.isActive,
        },
      });
      toast.success(draft.id ? "Voucher updated" : "Voucher created — print its QR code for the stall");
      setDraft(null);
      await mutate();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    try {
      await api(`/api/admin/vouchers/${id}`, { method: "DELETE" });
      toast.success("Voucher deleted");
      setDraft(null);
      await mutate();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const toDraft = (c: CampaignSummary): Draft => ({
    id: c.id,
    name: c.name,
    description: c.description ?? "",
    discountType: c.discountType,
    discountValue: String(c.discountValue),
    maxDiscount: c.maxDiscount ? String(c.maxDiscount) : "",
    minSpend: c.minSpend ? String(c.minSpend) : "",
    claimStartsAt: c.claimStartsOn ?? "",
    claimEndsAt: c.claimEndsOn ?? "",
    validDays: String(c.validDays),
    quota: c.quota ? String(c.quota) : "",
    isActive: c.isActive,
  });

  return (
    <>
      <PageHeader
        title="Vouchers"
        description="Customers scan the QR, confirm their email, and get a one-time discount code. Their details land in Customers."
        actions={
          <Button intent="sun" onClick={() => setDraft(blank)}>
            + New voucher
          </Button>
        }
      />

      {isLocal && campaigns.length > 0 && (
        <Panel className="mb-4 border-dashed bg-sun/30 p-3 text-sm font-semibold">
          These QR codes point to <code>{baseUrl}</code>. Set <code>APP_URL</code> to your live domain before printing them.
        </Panel>
      )}

      {campaigns.length === 0 ? (
        <EmptyState title="No vouchers yet">
          Create one (e.g. “20% off your first order”), print the QR code at the stall, and watch the customer list grow.
        </EmptyState>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {campaigns.map((c) => (
            <CampaignCard key={c.id} campaign={c} url={`${baseUrl}/v/${c.slug}`} onEdit={() => setDraft(toDraft(c))} />
          ))}
        </div>
      )}

      <Dialog
        open={draft !== null}
        onOpenChange={(o) => !o && setDraft(null)}
        title={draft?.id ? "Edit voucher" : "New voucher"}
        description="Changes apply to new claims. Vouchers already issued keep their discount."
        footer={
          <div className="flex justify-between gap-2">
            {draft?.id ? <ConfirmButton onConfirm={() => remove(draft.id!)}>Delete</ConfirmButton> : <span />}
            <Button intent="sun" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save voucher"}
            </Button>
          </div>
        }
      >
        {draft && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" className="sm:col-span-2">
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="First order at SMA Trinitas"
                maxLength={80}
              />
            </Field>
            <Field label="Short description (optional)" className="sm:col-span-2">
              <Textarea
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                placeholder="Valid for any fries or chicken bites."
                maxLength={300}
              />
            </Field>
            <div className="sm:col-span-2">
              <p className="mb-1.5 text-sm font-bold">Discount</p>
              <div className="grid grid-cols-2 gap-1 rounded-2xl border-2 border-navy bg-paper p-1">
                {(["PERCENT", "AMOUNT"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={draft.discountType === t}
                    onClick={() => setDraft({ ...draft, discountType: t })}
                    className={cn(
                      "h-11 rounded-xl font-display font-bold outline-none transition-[background-color,color,transform] duration-160 ease-out-strong focus-visible:ring-4 focus-visible:ring-sun/70 active:scale-[0.97]",
                      draft.discountType === t ? "bg-navy text-cream" : "hover:bg-navy/5",
                    )}
                  >
                    {t === "PERCENT" ? "% off" : "Rp off"}
                  </button>
                ))}
              </div>
            </div>
            <Field label={draft.discountType === "PERCENT" ? "Percent off" : "Rupiah off"}>
              <Input
                inputMode="numeric"
                value={draft.discountValue}
                onChange={(e) => setDraft({ ...draft, discountValue: digits(e.target.value) })}
                placeholder={draft.discountType === "PERCENT" ? "20" : "5000"}
              />
            </Field>
            {draft.discountType === "PERCENT" ? (
              <Field label="Max discount (Rp, optional)">
                <Input
                  inputMode="numeric"
                  value={draft.maxDiscount}
                  onChange={(e) => setDraft({ ...draft, maxDiscount: digits(e.target.value) })}
                  placeholder="10000"
                />
              </Field>
            ) : (
              <span className="hidden sm:block" />
            )}
            <Field label="Minimum spend (Rp)">
              <Input
                inputMode="numeric"
                value={draft.minSpend}
                onChange={(e) => setDraft({ ...draft, minSpend: digits(e.target.value) })}
                placeholder="0"
              />
            </Field>
            <Field label="Voucher works for (days)">
              <Input
                inputMode="numeric"
                value={draft.validDays}
                onChange={(e) => setDraft({ ...draft, validDays: digits(e.target.value) })}
              />
            </Field>
            <Field label="Claiming starts">
              <DatePicker clearable placeholder="Right away" value={draft.claimStartsAt} onChange={(v) => setDraft({ ...draft, claimStartsAt: v })} />
            </Field>
            <Field label="Claiming ends" hint="Leave empty to keep it open.">
              <DatePicker clearable placeholder="No end date" min={draft.claimStartsAt} value={draft.claimEndsAt} onChange={(v) => setDraft({ ...draft, claimEndsAt: v })} />
            </Field>
            <Field label="How many vouchers (optional)" hint="Stops claims when this many are issued.">
              <Input
                inputMode="numeric"
                value={draft.quota}
                onChange={(e) => setDraft({ ...draft, quota: digits(e.target.value) })}
                placeholder="Unlimited"
              />
            </Field>
            <div className="flex items-end">
              <Checkbox
                label="Active (customers can claim)"
                checked={draft.isActive}
                onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
              />
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}

function CampaignCard({ campaign: c, url, onEdit }: { campaign: CampaignSummary; url: string; onEdit: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const claimed = c.stats.issued + c.stats.redeemed;

  function downloadQr() {
    const el = canvas.current;
    if (!el) return;
    const a = document.createElement("a");
    a.href = el.toDataURL("image/png");
    a.download = `potatoni-voucher-${c.slug}.png`;
    a.click();
  }

  return (
    <Panel className="flex flex-col gap-4 p-4 sm:flex-row">
      <div className="flex shrink-0 flex-col items-center gap-2">
        <div className="rounded-2xl border-2 border-navy bg-white p-2">
          <QRCodeCanvas ref={canvas} value={url} size={512} level="M" marginSize={2} fgColor="#2a2670" className="size-32" />
        </div>
        <p className="font-mono text-xs text-navy-soft">/v/{c.slug}</p>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-display text-xl leading-tight font-extrabold">{c.name}</p>
            <p className="text-sm font-bold">
              {c.label}
              {c.minSpend > 0 && <span className="text-navy-soft"> · from {formatRupiah(c.minSpend)}</span>}
            </p>
            <p className="text-xs font-semibold text-navy-soft">
              Lasts {c.validDays} days after claiming
              {c.claimEndsOn && ` · claim by ${formatDay(c.claimEndsOn)}`}
              {c.quota != null && ` · ${c.quota} vouchers`}
            </p>
          </div>
          <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-extrabold uppercase", STATE[c.state].className)}>
            {STATE[c.state].label}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2 rounded-2xl bg-cream px-3 py-2 text-center">
          <Stat label="Claimed" value={claimed} />
          <Stat label="Used" value={c.stats.redeemed} />
          <Stat label="Waiting" value={c.stats.pending} hint="Started but didn't confirm their email yet" />
          <Stat label="Discount" value={formatRupiah(c.stats.discountGiven)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" intent="outline" onClick={() => navigator.clipboard.writeText(url).then(() => toast.success("Link copied"))}>
            Copy link
          </Button>
          <Button size="sm" intent="outline" onClick={downloadQr}>
            Download QR
          </Button>
          <Link href={`/dashboard/vouchers/${c.id}/poster`} className={buttonVariants({ intent: "outline", size: "sm" })}>
            Print poster
          </Link>
          <Button size="sm" intent="ghost" onClick={onEdit}>
            Edit
          </Button>
        </div>
      </div>
    </Panel>
  );
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="min-w-0" title={hint}>
      <p className="truncate text-[11px] font-bold tracking-wide text-navy-soft uppercase">{label}</p>
      <p className="truncate text-sm font-extrabold">{value}</p>
    </div>
  );
}
