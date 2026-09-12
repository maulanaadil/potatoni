import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity";
import { HttpError, handler, parseBody, requireApiSession } from "@/lib/api";
import { db } from "@/lib/db";
import { campaignData } from "@/lib/services/vouchers";
import { campaignInput } from "@/lib/validators";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler(async (request, { params }: Ctx) => {
  const session = await requireApiSession("ADMIN");
  const { id } = await params;
  const input = await parseBody(request, campaignInput);
  const campaign = await db.voucherCampaign.update({ where: { id }, data: campaignData(input) });
  await logActivity({
    action: "voucher.campaign_updated",
    message: `${session.name} updated voucher “${campaign.name}”`,
    source: "DASHBOARD",
    session,
    entityType: "voucherCampaign",
    entityId: id,
  });
  return NextResponse.json({ campaign });
});

export const DELETE = handler(async (_request, { params }: Ctx) => {
  const session = await requireApiSession("ADMIN");
  const { id } = await params;
  // Claimed vouchers belong to customers; keep them valid and just stop new claims.
  if (await db.voucherClaim.count({ where: { campaignId: id } })) {
    throw new HttpError(409, "People have already claimed this voucher. Turn off “Active” to stop new claims instead.");
  }
  const campaign = await db.voucherCampaign.delete({ where: { id } });
  await logActivity({
    action: "voucher.campaign_deleted",
    message: `${session.name} deleted voucher “${campaign.name}”`,
    source: "DASHBOARD",
    session,
    entityType: "voucherCampaign",
    entityId: id,
  });
  return NextResponse.json({ ok: true });
});
