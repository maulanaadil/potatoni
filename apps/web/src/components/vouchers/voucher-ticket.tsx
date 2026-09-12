"use client";

import { QRCodeSVG } from "qrcode.react";
import { cn } from "@/lib/cn";
import { formatDateTime, formatRupiah } from "@/lib/format";
import type { VoucherView } from "@/lib/services/vouchers";

const STATUS = {
  valid: { label: "Ready to use", className: "bg-leaf text-paper" },
  used: { label: "Used", className: "bg-cream text-navy" },
  expired: { label: "Expired", className: "bg-tomato text-paper" },
} as const;

/** The voucher the customer shows at the till: code + QR the cashier can type or scan. */
export function VoucherTicket({ voucher, pop = false }: { voucher: VoucherView; pop?: boolean }) {
  const faded = voucher.status !== "valid";
  return (
    <div
      className={cn(
        "overflow-hidden rounded-3xl border-2 border-navy bg-navy text-cream",
        pop && "animate-pop motion-reduce:animate-none",
      )}
    >
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <p className="font-display text-sm font-bold tracking-wide text-sun uppercase">{voucher.campaignName}</p>
          <p className="font-display text-4xl leading-tight font-extrabold">{voucher.label}</p>
          <p className="text-sm font-semibold text-cream/80">
            For {voucher.customerName}
            {voucher.minSpend > 0 && ` · orders from ${formatRupiah(voucher.minSpend)}`}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-extrabold uppercase",
            STATUS[voucher.status].className,
          )}
        >
          {STATUS[voucher.status].label}
        </span>
      </div>

      {/* Ticket perforation */}
      <div aria-hidden className="relative my-4 h-6">
        <span className="absolute top-0 -left-3 size-6 rounded-full bg-cream" />
        <span className="absolute top-0 -right-3 size-6 rounded-full bg-cream" />
        <span className="absolute inset-x-5 top-3 border-t-2 border-dashed border-cream/40" />
      </div>

      <div className={cn("flex flex-col items-center gap-3 px-5 pb-6", faded && "opacity-50")}>
        <div className="rounded-2xl bg-white p-3">
          <QRCodeSVG
            value={voucher.code}
            size={176}
            level="M"
            marginSize={1}
            fgColor="#2a2670"
            title={`Voucher ${voucher.code}`}
          />
        </div>
        <p className="font-display text-3xl font-extrabold tracking-[0.2em] text-sun">{voucher.code}</p>
        <p className="text-center text-sm font-semibold text-cream/80">
          {voucher.status === "used" && voucher.redeemedAt
            ? `Used on ${formatDateTime(voucher.redeemedAt)}`
            : voucher.expiresAt
              ? `${voucher.status === "expired" ? "Expired" : "Valid until"} ${formatDateTime(voucher.expiresAt)}`
              : null}
        </p>
      </div>
    </div>
  );
}
