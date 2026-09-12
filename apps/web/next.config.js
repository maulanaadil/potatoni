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
  },
};

export default nextConfig;
