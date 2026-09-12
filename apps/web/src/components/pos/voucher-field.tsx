"use client";

import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { useCart } from "@/lib/cart";
import { formatRupiah } from "@/lib/format";
import { VoucherScanner } from "./voucher-scanner";

type VoucherPreview = { code: string; discount: number; label: string; campaignName: string; customerName: string };

/** Live discount for the applied code; re-checked whenever the cart total changes. */
export function useVoucherPreview(subtotal: number) {
  const code = useCart((s) => s.voucherCode);
  const { data, error, isLoading } = useSWR<{ voucher: VoucherPreview }>(
    code && subtotal > 0 ? `/api/vouchers/check?code=${encodeURIComponent(code)}&subtotal=${subtotal}` : null,
    { keepPreviousData: false, revalidateOnFocus: false, shouldRetryOnError: false },
  );
  return {
    code,
    voucher: error ? null : (data?.voucher ?? null),
    error: code && error ? (error as Error).message : null,
    checking: isLoading,
  };
}

export function VoucherField({ preview }: { preview: ReturnType<typeof useVoucherPreview> }) {
  const setVoucherCode = useCart((s) => s.setVoucherCode);
  const [draft, setDraft] = useState("");
  const [scanning, setScanning] = useState(false);

  function apply(e: FormEvent) {
    e.preventDefault();
    if (draft.trim()) setVoucherCode(draft);
    setDraft("");
  }

  if (preview.code) {
    return (
      <div
        className={
          preview.error
            ? "rounded-2xl border-2 border-tomato bg-tomato/5 px-3 py-2"
            : "rounded-2xl border-2 border-dashed border-navy bg-sun/40 px-3 py-2"
        }
      >
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 text-sm">
            <span className="font-display font-extrabold tracking-wide">🎟️ {preview.code}</span>
            {preview.voucher && (
              <span className="block truncate text-navy-soft">
                {preview.voucher.label} · {preview.voucher.customerName}
              </span>
            )}
            {preview.checking && <span className="block text-navy-soft">Checking…</span>}
          </p>
          <button
            type="button"
            onClick={() => setVoucherCode(null)}
            className="h-11 shrink-0 rounded-lg px-3 text-sm font-bold text-tomato outline-none transition-colors duration-150 hover:bg-tomato/10 focus-visible:ring-4 focus-visible:ring-sun/70"
          >
            Remove
          </button>
        </div>
        {preview.error && <p className="mt-1 text-sm font-bold text-tomato">{preview.error}</p>}
        {preview.voucher && preview.voucher.discount > 0 && (
          <p className="mt-0.5 text-sm font-bold">−{formatRupiah(preview.voucher.discount)} on this order</p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={apply} className="flex gap-2">
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value.toUpperCase())}
        placeholder="Voucher code or scan"
        aria-label="Voucher code"
        autoCapitalize="characters"
        autoComplete="off"
        maxLength={20}
        className="font-display tracking-wide"
      />
      <Button
        intent="outline"
        size="icon"
        aria-label="Scan voucher QR with the camera"
        title="Scan voucher QR"
        onClick={() => setScanning(true)}
      >
        <svg viewBox="0 0 24 24" aria-hidden className="size-5">
          <path
            d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M7 12h10"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Button>
      <Button type="submit" intent="outline" disabled={!draft.trim()}>
        Apply
      </Button>
      <VoucherScanner
        open={scanning}
        onOpenChange={setScanning}
        onCode={(code) => {
          setScanning(false);
          setVoucherCode(code);
          toast.success(`Voucher ${code} scanned`);
        }}
      />
    </form>
  );
}
