import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { resendClaimCode } from "@/lib/services/vouchers";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler(async (request, { params }: Ctx) => {
  rateLimit(`resend:${clientIp(request)}`, 10, 10 * 60_000);
  const { id } = await params;
  return NextResponse.json(await resendClaimCode(id));
});
