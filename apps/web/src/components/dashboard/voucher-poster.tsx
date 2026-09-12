"use client";

import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { Button, buttonVariants } from "@/components/ui/button";

export function PosterQr({ value }: { value: string }) {
  return (
    <div className="rounded-3xl border-4 border-navy bg-white p-4">
      <QRCodeSVG
        value={value}
        size={260}
        level="M"
        marginSize={1}
        fgColor="#2a2670"
        title="Scan to claim a Potatoni voucher"
      />
    </div>
  );
}

export function PosterActions() {
  return (
    <div className="flex gap-2 print:hidden">
      <Link href="/dashboard/vouchers" className={buttonVariants({ intent: "ghost" })}>
        ← Vouchers
      </Link>
      <Button intent="sun" onClick={() => window.print()}>
        Print or save as PDF
      </Button>
    </div>
  );
}
