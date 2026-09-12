import { NextResponse } from "next/server";
import { handler, parseBody } from "@/lib/api";
import { appUrl } from "@/lib/email";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { verifyClaim } from "@/lib/services/vouchers";
import { verifyClaimInput } from "@/lib/validators";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler(async (request, { params }: Ctx) => {
  rateLimit(`verify:${clientIp(request)}`, 20, 10 * 60_000);
  const { id } = await params;
  const { code } = await parseBody(request, verifyClaimInput);
  return NextResponse.json({ voucher: await verifyClaim(id, code, appUrl(request)) });
});
