import type { Metadata } from "next";
import { LocationManager } from "@/components/dashboard/location-manager";
import { getLocationSummaries } from "@/lib/services/locations";

export const metadata: Metadata = { title: "Locations" };

export default async function LocationsPage() {
  return <LocationManager locations={await getLocationSummaries()} />;
}
