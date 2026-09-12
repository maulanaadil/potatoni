import type { MetadataRoute } from "next";

// Lets the register be added to an iPad/iPhone home screen and run full-screen.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Potatoni — Register & Dashboard",
    short_name: "Potatoni",
    description: "Crispy outside, happy inside. Point of sale and owner dashboard for Potatoni.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f8f1e6",
    theme_color: "#f8f1e6",
    categories: ["business", "food"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
