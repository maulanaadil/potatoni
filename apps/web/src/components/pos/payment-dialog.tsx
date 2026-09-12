"use client";

import { cn } from "@/lib/cn";
import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/field";
import { api } from "@/lib/client";
import { formatK, formatRupiah } from "@/lib/format";
import { toDynamicQris } from "@/lib/qris";
import type { OrderView } from "@/lib/views";

function cashSuggestions(total: number) {
  const up = (step: number) => Math.ceil(total / step) * step;
  return [...new Set([total, up(5000), up(10000), up(50000), up(100000)])].slice(0, 4);
}

export function PaymentDialog({
  order,
  onClose,
  onSettled,
}: {
  order: OrderView | null;
  onClose: () => void;
  onSettled?: (status: OrderView["status"], order: OrderView) => void;
}) {
  const [shown, setShown] = useState<OrderView | null>(null);
  const [method, setMethod] = useState<"QRIS" | "CASH">("QRIS");
  const [printedQr, setPrintedQr] = useState(false);
  const [cash, setCash] = useState("");
  const [busy, setBusy] = useState<"pay" | "cancel" | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => {
    if (!order) return;
    setShown(order);
    setMethod(order.paymentMethod);
    setPrintedQr(false);
    setCash("");
    setConfirmCancel(false);
  }, [order]);

  const qris = useMemo(() => (shown ? toDynamicQris(shown.total) : ""), [shown]);
  const cashValue = Number(cash.replace(/\D/g, "")) || 0;
  const change = shown ? cashValue - shown.total : 0;
  const isPaid = shown?.status === "PAID";

  async function markPaid() {
    if (!shown) return;
    setBusy("pay");
    try {
      const { order: updated } = await api<{ order: OrderView }>(`/api/orders/${shown.id}/pay`, {
        body: { paymentMethod: method, cashReceived: method === "CASH" ? cashValue : undefined },
      });
      setShown(updated);
      onSettled?.("PAID", updated);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function cancel() {
    if (!shown) return;
    if (!confirmCancel) {
      setConfirmCancel(true);
      return;
    }
    setBusy("cancel");
    try {
      const { order: updated } = await api<{ order: OrderView }>(`/api/orders/${shown.id}/cancel`, {
        method: "POST",
      });
      toast(`Order ${updated.code} cancelled`);
      onSettled?.("CANCELLED", updated);
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function close() {
    // Leaving a pending order is fine — it stays in Orders until it's paid or cancelled.
    if (shown?.status === "PENDING") onSettled?.("PENDING", shown);
    onClose();
  }

  return (
    <Dialog
      open={order !== null}
      onOpenChange={(open) => !open && close()}
      title={isPaid ? "Payment received" : `Charge ${shown ? formatRupiah(shown.total) : ""}`}
      description={shown ? `Order ${shown.code}${shown.customerName ? ` · ${shown.customerName}` : ""}` : undefined}
      footer={
        isPaid ? (
          <Button intent="sun" size="lg" className="w-full" onClick={onClose}>
            New order
          </Button>
        ) : (
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button intent="danger" size="lg" onClick={cancel} disabled={busy !== null}>
              {confirmCancel ? "Tap again to cancel" : "Cancel order"}
            </Button>
            <Button
              intent="success"
              size="lg"
              className="flex-1"
              onClick={markPaid}
              disabled={busy !== null || (method === "CASH" && change < 0)}
            >
              {busy === "pay" ? "Saving…" : method === "QRIS" ? "Payment received" : "Complete cash sale"}
            </Button>
          </div>
        )
      }
    >
      {shown && isPaid ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <span className="grid size-20 animate-pop place-items-center rounded-full border-2 border-navy bg-leaf text-4xl text-paper motion-reduce:animate-none">
            ✓
          </span>
          <p className="font-display text-2xl font-extrabold">{shown.code} is paid</p>
          <p className="text-navy-soft">
            {formatRupiah(shown.total)} via {shown.paymentMethod === "QRIS" ? "QRIS" : "cash"}
          </p>
          {shown.paymentMethod === "CASH" && shown.cashReceived != null && (
            <p className="rounded-2xl bg-sun px-5 py-3 font-display text-xl font-extrabold">
              Change: {formatRupiah(shown.cashReceived - shown.total)}
            </p>
          )}
          <p className="font-display text-sm font-bold tracking-wide text-navy-soft uppercase">
            Good potato, good mood.
          </p>
        </div>
      ) : shown ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-1 rounded-2xl border-2 border-navy bg-paper p-1">
            {(["QRIS", "CASH"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={method === m}
                onClick={() => setMethod(m)}
                className={cn(
                  "h-11 rounded-xl font-display font-bold outline-none transition-[background-color,color,transform] duration-160 ease-out-strong focus-visible:ring-4 focus-visible:ring-sun/70 active:scale-[0.97]",
                  method === m ? "bg-navy text-cream" : "hover:bg-navy/5",
                )}
              >
                {m === "QRIS" ? "QRIS" : "Cash"}
              </button>
            ))}
          </div>

          {method === "QRIS" ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-full max-w-72 rounded-3xl border-2 border-navy bg-white p-4">
                {printedQr ? (
                  <Image
                    src="/api/media/payment/qris.jpg"
                    alt="Potatoni printed QRIS"
                    width={908}
                    height={1280}
                    className="h-auto w-full"
                  />
                ) : (
                  <>
                    <p className="text-center font-display text-lg font-extrabold tracking-wide">POTATONI</p>
                    <QRCodeSVG value={qris} level="M" marginSize={1} className="h-auto w-full" title="QRIS payment code" />
                    <p className="mt-1 text-center text-[11px] font-bold text-navy-soft">NMID ID1026581364258 · A01</p>
                  </>
                )}
              </div>
              <p className="font-display text-4xl font-extrabold tabular-nums">{formatRupiah(shown.total)}</p>
              <p className="max-w-sm text-center text-sm text-navy/65">
                {printedQr
                  ? "The customer types the amount manually with the printed QRIS."
                  : "The amount is already inside this QR. Confirm only after you see the incoming payment notification."}
              </p>
              <button
                type="button"
                onClick={() => setPrintedQr((v) => !v)}
                className="text-sm font-bold text-navy/70 underline underline-offset-4 hover:text-navy"
              >
                {printedQr ? "Show QR with amount" : "Customer's app can't scan it? Use the printed QRIS"}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-bold">Cash received</span>
                <Input
                  inputMode="numeric"
                  autoFocus
                  placeholder={String(shown.total)}
                  value={cashValue ? cashValue.toLocaleString("id-ID") : ""}
                  onChange={(e) => setCash(e.target.value)}
                  className="h-14 text-2xl"
                />
              </label>
              <div className="grid grid-cols-4 gap-2">
                {cashSuggestions(shown.total).map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => setCash(String(amount))}
                    className="rounded-xl border-2 border-navy/15 bg-white py-2 font-display font-bold transition-[border-color,transform] duration-160 ease-out-strong hover:border-navy active:scale-[0.97]"
                  >
                    {amount === shown.total ? "Exact" : formatK(amount)}
                  </button>
                ))}
              </div>
              <div
                className={cn(
                  "flex items-baseline justify-between rounded-2xl px-4 py-3 font-display transition-colors duration-150",
                  change >= 0 && cashValue > 0 ? "bg-sun" : "bg-cream-deep",
                )}
              >
                <span className="font-bold">{change < 0 && cashValue > 0 ? "Still short" : "Change"}</span>
                <span className="text-2xl font-extrabold tabular-nums">
                  {cashValue ? formatRupiah(Math.abs(change)) : "—"}
                </span>
              </div>
            </div>
          )}

          <details className="rounded-2xl border-2 border-navy/10 px-4 py-2">
            <summary className="cursor-pointer font-bold">
              {shown.items.reduce((s, i) => s + i.quantity, 0)} items
            </summary>
            <ul className="mt-2 flex flex-col gap-1 pb-1 text-sm">
              {shown.items.map((item) => (
                <li key={item.id} className="flex justify-between gap-2">
                  <span>
                    {item.quantity}× {item.productName} {item.variantSize}
                    {item.modifiers.length > 0 && (
                      <span className="text-navy-soft"> · {item.modifiers.map((m) => m.name).join(", ")}</span>
                    )}
                  </span>
                  <span className="font-bold tabular-nums">{formatRupiah(item.lineTotal)}</span>
                </li>
              ))}
            </ul>
          </details>
        </div>
      ) : null}
    </Dialog>
  );
}
