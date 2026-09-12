import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { PosterActions, PosterQr } from "@/components/dashboard/voucher-poster";
import { Logo, Sparkles } from "@/components/ui/brand";
import { db } from "@/lib/db";
import { formatDay, formatRupiah } from "@/lib/format";
import { dateKey } from "@/lib/services/locations";
import { discountLabel } from "@/lib/services/vouchers";

export const metadata: Metadata = { title: "Voucher poster" };

// A4 poster for the stall: print it or save as PDF. The dashboard nav is hidden when printing.
export default async function PosterPage({ params }: { params: Promise<{ id: string }> }) {
  const campaign = await db.voucherCampaign.findUnique({ where: { id: (await params).id } });
  if (!campaign) notFound();
  const h = await headers();
  const baseUrl = (process.env.APP_URL ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`).replace(
    /\/$/,
    "",
  );
  const url = `${baseUrl}/v/${campaign.slug}`;
  const endsOn = dateKey(campaign.claimEndsAt);

  return (
    <div className="flex flex-col items-center gap-4">
      <PosterActions />
      {/* Sizes are in cqw (share of the poster's width), so the A4 layout scales as a whole instead of clipping on phones. */}
      <div className="@container w-full max-w-[640px] print:max-w-none">
        <article className="relative flex aspect-[210/297] w-full flex-col items-center justify-between overflow-hidden rounded-3xl border-4 border-navy bg-cream p-[6.25cqw] text-center print:rounded-none print:border-0">
          <Sparkles className="absolute top-[5cqw] left-[5cqw] h-[7.5cqw] text-navy" />
          <Sparkles className="absolute right-[6cqw] bottom-[40cqw] h-[6.25cqw] rotate-12 text-navy" />
          <Logo priority className="h-auto w-3/5" />
          <div>
            <p className="font-display text-[length:3.75cqw] font-extrabold tracking-wide uppercase">
              Scan for a voucher
            </p>
            <p className="font-display text-[length:11.25cqw] leading-none font-extrabold">{discountLabel(campaign)}</p>
            <p className="mt-[1.25cqw] text-[length:2.8cqw] font-bold">{campaign.name}</p>
          </div>
          <PosterQr value={url} />
          <div className="text-[length:2.2cqw] font-bold">
            <p>1. Scan · 2. Fill in your name, WhatsApp &amp; email · 3. Confirm the code we email you</p>
            <p className="mt-[0.6cqw] text-navy-soft">
              {campaign.minSpend > 0 && `Orders from ${formatRupiah(campaign.minSpend)} · `}
              One per person{endsOn && ` · claim by ${formatDay(endsOn)}`}
            </p>
          </div>
          <p className="w-full rounded-full bg-navy py-[1.25cqw] font-display text-[length:2.8cqw] font-extrabold tracking-wide text-sun uppercase">
            Good potato, good mood.
          </p>
        </article>
      </div>
    </div>
  );
}
