import { NextResponse } from "next/server";
import { handler, requireApiSession } from "@/lib/api";
import { dateKey, getScheduledLocation, listLocations } from "@/lib/services/locations";

// Register: active spots + the one scheduled for today (the default for new orders).
export const GET = handler(async () => {
  await requireApiSession();
  const [locations, scheduled] = await Promise.all([listLocations(), getScheduledLocation()]);
  return NextResponse.json({
    scheduledId: scheduled?.id ?? null,
    locations: locations.map((l) => ({
      id: l.id,
      name: l.name,
      address: l.address,
      startsOn: dateKey(l.startsOn),
      endsOn: dateKey(l.endsOn),
    })),
  });
});
