import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity";
import { handler, parseBody, requireApiSession } from "@/lib/api";
import { db } from "@/lib/db";
import { getLocationSummaries } from "@/lib/services/locations";
import { locationInput } from "@/lib/validators";

// Every location with its all-time sales, purchases and product breakdown.
export const GET = handler(async () => {
  await requireApiSession("ADMIN");
  return NextResponse.json({ locations: await getLocationSummaries() });
});

export const POST = handler(async (request) => {
  const session = await requireApiSession("ADMIN");
  const data = await parseBody(request, locationInput);
  const location = await db.location.create({ data });
  await logActivity({
    action: "location.created",
    message: `${session.name} added location ${location.name}`,
    source: "DASHBOARD",
    session,
    entityType: "location",
    entityId: location.id,
  });
  return NextResponse.json({ location }, { status: 201 });
});
