/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Product photos live in S3 and are streamed through /api/media.
    localPatterns: [{ pathname: "/api/media/**" }],
  },
  serverExternalPackages: ["@prisma/client", "pg"],
};

export default nextConfig;
