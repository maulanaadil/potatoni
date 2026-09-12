import type { Metadata } from "next";
import { headers } from "next/headers";
import { VoucherManager } from "@/components/dashboard/voucher-manager";
import { listCampaigns } from "@/lib/services/vouchers";

export const metadata: Metadata = { title: "Vouchers" };

export default async function VouchersPage() {
  const h = await headers();
  // The printed QR must point at the live site, so prefer APP_URL over whatever host we're on.
  const baseUrl = (process.env.APP_URL ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`).replace(/\/$/, "");
  return <VoucherManager campaigns={await listCampaigns()} baseUrl={baseUrl} />;
}
