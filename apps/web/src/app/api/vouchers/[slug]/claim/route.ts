import { NextResponse } from "next/server";
import { handler, parseBody } from "@/lib/api";
import { appUrl } from "@/lib/email";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { startClaim } from "@/lib/services/vouchers";
import { claimInput } from "@/lib/validators";

type Ctx = { params: Promise<{ slug: string }> };

// Public (customers scanning the QR): name + WhatsApp + email → 6-digit code by email.
export const POST = handler(async (request, { params }: Ctx) => {
  rateLimit(`claim:${clientIp(request)}`, 10, 10 * 60_000);
  const { slug } = await params;
  const input = await parseBody(request, claimInput);
  rateLimit(`claim-email:${input.email}`, 5, 10 * 60_000);
  return NextResponse.json(await startClaim(slug, input, appUrl(request)), { status: 201 });
});
