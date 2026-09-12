import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity";
import { handler, parseBody, requireApiSession } from "@/lib/api";
import { db } from "@/lib/db";
import { campaignData, discountLabel, listCampaigns } from "@/lib/services/vouchers";
import { newSlug } from "@/lib/tokens";
import { campaignInput } from "@/lib/validators";

export const GET = handler(async () => {
  await requireApiSession("ADMIN");
  return NextResponse.json({ campaigns: await listCampaigns() });
});

export const POST = handler(async (request) => {
  const session = await requireApiSession("ADMIN");
  const input = await parseBody(request, campaignInput);
  const campaign = await db.voucherCampaign.create({ data: { ...campaignData(input), slug: newSlug() } });
  await logActivity({
    action: "voucher.campaign_created",
    message: `${session.name} created voucher “${campaign.name}” (${discountLabel(campaign)})`,
    source: "DASHBOARD",
    session,
    entityType: "voucherCampaign",
    entityId: campaign.id,
  });
  return NextResponse.json({ campaign }, { status: 201 });
});
