import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Logo, Sparkles } from "@/components/ui/brand";
import { ClaimFlow } from "@/components/vouchers/claim-flow";
import { getPublicCampaign } from "@/lib/services/vouchers";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const campaign = await getPublicCampaign((await params).slug);
  return campaign
    ? { title: `${campaign.label} — ${campaign.name}`, description: `Claim your Potatoni voucher: ${campaign.label}.` }
    : { title: "Voucher not found" };
}

export const dynamic = "force-dynamic";

// Public page behind the printed QR code. Mobile first: customers open it on their phone.
export default async function ClaimPage({ params }: Props) {
  const campaign = await getPublicCampaign((await params).slug);
  if (!campaign) notFound();

  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-10">
      <Sparkles className="absolute top-6 right-4 h-10 text-navy opacity-60" />
      <Logo priority className="mx-auto h-auto w-56" />
      <ClaimFlow campaign={campaign} />
      <p className="mt-auto text-center font-display text-sm font-bold tracking-wide text-navy-soft uppercase">
        Good potato, good mood.
      </p>
    </main>
  );
}
