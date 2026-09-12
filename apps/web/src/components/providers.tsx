"use client";

import { SWRConfig } from "swr";
import { api } from "@/lib/client";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher: (url: string) => api(url),
        keepPreviousData: true,
        revalidateOnFocus: true,
        dedupingInterval: 2000,
      }}
    >
      {children}
    </SWRConfig>
  );
}
