import { LocationBar } from "@/components/pos/location-bar";
import { PosLocationProvider } from "@/components/pos/location-context";
import { PosHeader } from "@/components/pos/pos-header";
import { requirePageSession } from "@/lib/auth";
import { dateKey, getScheduledLocation, listLocations } from "@/lib/services/locations";

export default async function PosLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePageSession();
  const [locations, scheduled] = await Promise.all([listLocations(), getScheduledLocation()]);
  const initial = {
    scheduledId: scheduled?.id ?? null,
    locations: locations.map((l) => ({
      id: l.id,
      name: l.name,
      address: l.address,
      startsOn: dateKey(l.startsOn),
      endsOn: dateKey(l.endsOn),
    })),
  };

  return (
    <PosLocationProvider initial={initial}>
      <div className="flex min-h-dvh flex-col">
        <PosHeader name={session.name} role={session.role} />
        <LocationBar />
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 pt-4 pb-28 md:px-6 lg:pb-8">{children}</main>
      </div>
    </PosLocationProvider>
  );
}
