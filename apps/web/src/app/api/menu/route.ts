import { NextResponse } from "next/server";
import { handler, requireApiSession } from "@/lib/api";
import { getMenu } from "@/lib/services/menu";

export const GET = handler(async () => {
  await requireApiSession();
  return NextResponse.json(await getMenu());
});
