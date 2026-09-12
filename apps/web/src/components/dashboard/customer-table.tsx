"use client";

import { useDeferredValue, useState } from "react";
import useSWR from "swr";
import { EmptyState, Panel } from "@/components/ui/brand";
import { buttonVariants } from "@/components/ui/button";
import { Checkbox, Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import type { CustomerRow } from "@/lib/services/vouchers";
import { PageHeader } from "./common";

const waLink = (phone: string) => `https://wa.me/${phone.replace(/\D/g, "")}`;

export function CustomerTable({ customers: initial }: { customers: CustomerRow[] }) {
  const [q, setQ] = useState("");
  const [consentOnly, setConsentOnly] = useState(false);
  const query = useDeferredValue(q.trim());
  const key = `/api/admin/customers?${new URLSearchParams({ ...(query ? { q: query } : {}), ...(consentOnly ? { consent: "1" } : {}) })}`;
  const { data } = useSWR<{ customers: CustomerRow[] }>(key, {
    fallbackData: !query && !consentOnly ? { customers: initial } : undefined,
  });
  const customers = data?.customers ?? [];
  const consented = initial.filter((c) => c.marketingConsent).length;

  return (
    <>
      <PageHeader
        title="Customers"
        description={`${initial.length} people from voucher claims · ${consented} agreed to promos. Only message people who agreed.`}
        actions={
          <>
            {/* Plain links: the browser downloads the CSV with the session cookie. */}
            <a href="/api/admin/customers/export" className={buttonVariants({ intent: "sun" })}>
              Export promo list (CSV)
            </a>
            <a href="/api/admin/customers/export?all=1" className={buttonVariants({ intent: "outline" })}>
              Export everyone
            </a>
          </>
        }
      />

      <Panel className="mb-4 flex flex-wrap items-center gap-3 p-4">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, email or WhatsApp"
          aria-label="Search customers"
          className="max-w-sm flex-1"
        />
        <Checkbox
          label="Agreed to promos only"
          checked={consentOnly}
          onChange={(e) => setConsentOnly(e.target.checked)}
        />
      </Panel>

      {customers.length === 0 ? (
        <EmptyState title={initial.length ? "No one matches that search" : "No customers yet"}>
          {initial.length ? null : "When people claim a voucher from the QR code, they show up here."}
        </EmptyState>
      ) : (
        <Panel className="overflow-hidden">
          <ul className="divide-y-2 divide-navy/10 md:hidden">
            {customers.map((c) => (
              <li key={c.id} className="flex flex-col gap-1 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-bold">{c.name}</p>
                  <Badges c={c} />
                </div>
                <p className="truncate text-sm text-navy-soft">{c.email}</p>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <a
                    href={waLink(c.phone)}
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold text-leaf underline-offset-4 hover:underline"
                  >
                    {c.phone}
                  </a>
                  <span className="font-semibold text-navy-soft">
                    {c.used}/{c.vouchers} used
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <table className="hidden w-full text-left text-sm md:table">
            <thead className="border-b-2 border-navy bg-cream-deep/60 font-display text-xs tracking-wide uppercase">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">WhatsApp</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Vouchers</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-navy/10">
              {customers.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-bold">
                    {c.name}
                    {c.campaigns.length > 0 && (
                      <span className="block max-w-56 truncate text-xs font-semibold text-navy-soft">
                        {c.campaigns.join(" · ")}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={waLink(c.phone)}
                      target="_blank"
                      rel="noreferrer"
                      className="font-bold text-leaf underline-offset-4 hover:underline"
                    >
                      {c.phone}
                    </a>
                  </td>
                  <td className="max-w-56 truncate px-4 py-3">{c.email}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {c.used}/{c.vouchers} used
                  </td>
                  <td className="px-4 py-3">
                    <Badges c={c} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </>
  );
}

function Badges({ c }: { c: CustomerRow }) {
  return (
    <span className="flex shrink-0 gap-1">
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-[11px] font-extrabold uppercase",
          c.verified ? "bg-leaf/15 text-leaf" : "bg-navy/10 text-navy-soft",
        )}
      >
        {c.verified ? "Verified" : "Unverified"}
      </span>
      {c.marketingConsent && (
        <span className="rounded-full bg-sun px-2 py-0.5 text-[11px] font-extrabold uppercase">Promos OK</span>
      )}
    </span>
  );
}
