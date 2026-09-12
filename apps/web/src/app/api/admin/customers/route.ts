import { NextResponse } from "next/server";
import { handler, requireApiSession } from "@/lib/api";
import { listCustomers } from "@/lib/services/vouchers";

// ?q=search&consent=1 (only people who agreed to promos)
export const GET = handler(async (request) => {
  await requireApiSession("ADMIN");
  const url = new URL(request.url);
  const customers = await listCustomers({
    q: url.searchParams.get("q")?.trim() || undefined,
    consentOnly: url.searchParams.get("consent") === "1",
  });
  return NextResponse.json({ customers });
});
