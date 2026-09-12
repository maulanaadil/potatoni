import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Logo, Panel } from "@/components/ui/brand";
import { VoucherTicket } from "@/components/vouchers/voucher-ticket";
import { getVoucherByCode } from "@/lib/services/vouchers";

export const metadata: Metadata = { title: "My voucher" };
export const dynamic = "force-dynamic";

// Linked from the voucher email ("Open my voucher"). The code itself is what the cashier needs.
export default async function VoucherPage({ params }: { params: Promise<{ code: string }> }) {
  const voucher = await getVoucherByCode((await params).code);
  if (!voucher) notFound();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-10">
      <Logo priority className="mx-auto h-auto w-48" />
      <VoucherTicket voucher={voucher} />
      <Panel className="p-4 text-center text-sm">
        <p className="font-display text-lg font-extrabold">
          {voucher.status === "valid"
            ? "Show this to the cashier"
            : voucher.status === "used"
              ? "Enjoy your fries!"
              : "This voucher has expired"}
        </p>
        <p className="text-navy-soft">Potatoni · Crispy outside, happy inside.</p>
      </Panel>
    </main>
  );
}
