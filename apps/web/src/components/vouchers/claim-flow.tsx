"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Panel } from "@/components/ui/brand";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { api } from "@/lib/client";
import { formatDay, formatRupiah } from "@/lib/format";
import type { PublicCampaign, VoucherView } from "@/lib/services/vouchers";
import { VoucherTicket } from "./voucher-ticket";

type Step =
  | { name: "form" }
  | { name: "verify"; claimId: string; email: string; devCode?: string }
  | { name: "done"; voucher: VoucherView };

const CLOSED_COPY: Record<Exclude<PublicCampaign["state"], "open">, string> = {
  inactive: "This voucher isn't available any more.",
  "not-started": "Claiming hasn't started yet.",
  ended: "This voucher offer has ended.",
  "sold-out": "All vouchers have been claimed. Thanks for stopping by!",
};

export function ClaimFlow({ campaign }: { campaign: PublicCampaign }) {
  const [step, setStep] = useState<Step>({ name: "form" });
  const [form, setForm] = useState({ name: "", phone: "", email: "", marketingConsent: false });
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const submitForm = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const res = await api<{ claimId: string; email: string; devCode?: string }>(`/api/vouchers/${campaign.slug}/claim`, {
        body: form,
      });
      setCode("");
      setCooldown(30);
      setStep({ name: "verify", ...res });
    });
  };

  const submitCode = (e: FormEvent) => {
    e.preventDefault();
    if (step.name !== "verify") return;
    void run(async () => {
      const { voucher } = await api<{ voucher: VoucherView }>(`/api/vouchers/claims/${step.claimId}/verify`, {
        body: { code },
      });
      setStep({ name: "done", voucher });
    });
  };

  const resend = () => {
    if (step.name !== "verify") return;
    void run(async () => {
      const res = await api<{ email: string; devCode?: string }>(`/api/vouchers/claims/${step.claimId}/resend`, {
        method: "POST",
      });
      setStep({ ...step, ...res });
      setCooldown(30);
      setNotice("New code sent. Check your inbox (and spam).");
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {step.name !== "done" && (
        <Panel className="overflow-hidden bg-navy text-cream">
          <div className="px-5 py-5">
            <p className="font-display text-sm font-bold tracking-wide text-sun uppercase">{campaign.name}</p>
            <p className="font-display text-5xl leading-none font-extrabold">{campaign.label}</p>
            {campaign.description && <p className="mt-2 text-sm font-semibold text-cream/85">{campaign.description}</p>}
            <ul className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
              {campaign.minSpend > 0 && (
                <li className="rounded-full bg-cream/15 px-2.5 py-1">Orders from {formatRupiah(campaign.minSpend)}</li>
              )}
              <li className="rounded-full bg-cream/15 px-2.5 py-1">Valid {campaign.validDays} days</li>
              {campaign.claimEndsOn && (
                <li className="rounded-full bg-cream/15 px-2.5 py-1">Claim by {formatDay(campaign.claimEndsOn)}</li>
              )}
              {campaign.remaining != null && campaign.state === "open" && (
                <li className="rounded-full bg-sun px-2.5 py-1 text-navy">{campaign.remaining} left</li>
              )}
            </ul>
          </div>
        </Panel>
      )}

      {campaign.state !== "open" && step.name === "form" ? (
        <Panel className="p-5 text-center">
          <p className="font-display text-xl font-extrabold">{CLOSED_COPY[campaign.state]}</p>
          <p className="mt-1 text-sm text-navy-soft">Follow Potatoni for the next one — good potato, good mood.</p>
        </Panel>
      ) : step.name === "form" ? (
        <Panel key="form" className="animate-rise p-5 motion-reduce:animate-none">
          <h1 className="font-display text-2xl font-extrabold">Get your voucher</h1>
          <p className="mb-4 text-sm font-semibold text-navy-soft">We&apos;ll email you a code to confirm it&apos;s really you.</p>
          <form onSubmit={submitForm} className="flex flex-col gap-3">
            <Field label="Your name">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                autoComplete="name"
                required
                maxLength={60}
              />
            </Field>
            <Field label="WhatsApp number">
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="0812 3456 7890"
                required
              />
            </Field>
            <Field label="Email">
              <Input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@email.com"
                required
              />
            </Field>
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-cream px-3 py-3 text-sm">
              <input
                type="checkbox"
                checked={form.marketingConsent}
                onChange={(e) => setForm({ ...form, marketingConsent: e.target.checked })}
                className="mt-0.5 size-5 shrink-0 accent-navy"
              />
              <span>
                <span className="font-bold">Send me Potatoni promos</span> by WhatsApp and email. You can stop them any time.
              </span>
            </label>
            {error && <p className="rounded-xl bg-tomato/10 px-3 py-2 text-sm font-bold text-tomato">{error}</p>}
            <Button type="submit" intent="sun" size="lg" disabled={busy}>
              {busy ? "Sending code…" : "Get my voucher"}
            </Button>
            <p className="text-center text-xs text-navy-soft">
              One voucher per person. We use your details to send your voucher
              {form.marketingConsent ? " and Potatoni promos" : ""}, never sold to anyone.
            </p>
          </form>
        </Panel>
      ) : step.name === "verify" ? (
        <Panel key="verify" className="animate-rise p-5 motion-reduce:animate-none">
          <h1 className="font-display text-2xl font-extrabold">Check your email</h1>
          <p className="mb-4 text-sm font-semibold text-navy-soft">
            We sent a 6-digit code to <span className="text-navy">{step.email}</span>. It works for 10 minutes.
          </p>
          {step.devCode && (
            <p className="mb-3 rounded-xl bg-sun px-3 py-2 text-sm font-bold">
              Dev mode (no SMTP set up): the email wasn&apos;t sent. Your code is {step.devCode}.
            </p>
          )}
          <form onSubmit={submitCode} className="flex flex-col gap-3">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              aria-label="6-digit code"
              placeholder="••••••"
              className="h-16 text-center font-display text-4xl tracking-[0.5em]"
            />
            {error && <p className="rounded-xl bg-tomato/10 px-3 py-2 text-sm font-bold text-tomato">{error}</p>}
            {notice && <p className="rounded-xl bg-leaf/10 px-3 py-2 text-sm font-bold text-leaf">{notice}</p>}
            <Button type="submit" intent="sun" size="lg" disabled={busy || code.length !== 6}>
              {busy ? "Checking…" : "Confirm"}
            </Button>
            <div className="flex items-center justify-between gap-2 text-sm font-bold">
              <button
                type="button"
                onClick={() => {
                  setStep({ name: "form" });
                  setError(null);
                }}
                className="min-h-11 rounded-lg px-2 text-navy-soft outline-none hover:text-navy focus-visible:ring-4 focus-visible:ring-sun/70"
              >
                ← Change email
              </button>
              <button
                type="button"
                onClick={resend}
                disabled={busy || cooldown > 0}
                className="min-h-11 rounded-lg px-2 outline-none hover:underline focus-visible:ring-4 focus-visible:ring-sun/70 disabled:text-navy-soft disabled:no-underline"
              >
                {cooldown > 0 ? `Send a new code in ${cooldown}s` : "Send a new code"}
              </button>
            </div>
          </form>
        </Panel>
      ) : (
        <div className="flex flex-col gap-3">
          <VoucherTicket voucher={step.voucher} pop />
          <Panel className="p-4 text-center text-sm">
            <p className="font-display text-lg font-extrabold">Show this to the cashier 🎉</p>
            <p className="text-navy-soft">We also emailed it to you. A screenshot works too.</p>
          </Panel>
        </div>
      )}
    </div>
  );
}
