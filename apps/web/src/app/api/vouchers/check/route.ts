import { NextResponse } from "next/server";
import { HttpError, handler, requireApiSession } from "@/lib/api";
import { evaluateVoucher } from "@/lib/services/vouchers";

// Register: preview a voucher's discount for the current cart (the order re-checks it).
export const GET = handler(async (request) => {
  await requireApiSession();
  const url = new URL(request.url);
  const code = url.searchParams.get("code")?.trim();
  if (!code) throw new HttpError(400, "Enter a voucher code");
  const subtotal = Math.max(0, Number(url.searchParams.get("subtotal")) || 0);
  const { claimId: _claimId, ...voucher } = await evaluateVoucher(code, subtotal);
  return NextResponse.json({ voucher });
});
