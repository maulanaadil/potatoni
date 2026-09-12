/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Product photos live in S3 and are streamed through /api/media.
    localPatterns: [{ pathname: "/api/media/**" }],
  },
  serverExternalPackages: ["@prisma/client", "pg"],
  experimental: {
    // Keep visited dynamic pages in the client router cache briefly, so hopping between
    // register/dashboard tabs is instant (SWR still refetches live data on mount).
    staleTimes: { dynamic: 30 },
    // Failed navigations wait for the connection and retry instead of throwing (see OfflineBanner).
    useOffline: true,
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
