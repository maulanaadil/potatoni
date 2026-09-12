"use client";

import { createContext, type ReactNode, useContext, useSyncExternalStore } from "react";
import useSWR from "swr";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { jakartaDateKey } from "@/lib/format";

export type PosLocation = {
  id: string;
  name: string;
  address: string | null;
  startsOn: string | null;
  endsOn: string | null;
};
type LocationsPayload = { locations: PosLocation[]; scheduledId: string | null };

// A manual pick only lasts for the day it was made; tomorrow the schedule takes over again.
const useOverride = create<{
  override: { day: string; id: string | null } | null;
  set: (id: string | null) => void;
  clear: () => void;
}>()(
  persist(
    (set) => ({
      override: null,
      set: (id) => set({ override: { day: jakartaDateKey(), id } }),
      clear: () => set({ override: null }),
    }),
    { name: "potatoni-location" },
  ),
);

const LocationContext = createContext<LocationsPayload>({ locations: [], scheduledId: null });

export function PosLocationProvider({ initial, children }: { initial: LocationsPayload; children: ReactNode }) {
  // Picks up schedule changes from the dashboard (and the day rolling over).
  const { data = initial } = useSWR<LocationsPayload>("/api/locations", {
    fallbackData: initial,
    refreshInterval: 5 * 60_000,
  });
  return <LocationContext.Provider value={data}>{children}</LocationContext.Provider>;
}

const useHydrated = () =>
  useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

export function useCurrentLocation() {
  const { locations, scheduledId } = useContext(LocationContext);
  const hydrated = useHydrated();
  const { override, set, clear } = useOverride();
  const active = hydrated && override?.day === jakartaDateKey() ? override : null;
  const locationId = active ? active.id : scheduledId;
  return {
    locations,
    scheduledId,
    locationId,
    location: locations.find((l) => l.id === locationId) ?? null,
    isOverride: active !== null && active.id !== scheduledId,
    choose: set,
    followSchedule: clear,
  };
}
