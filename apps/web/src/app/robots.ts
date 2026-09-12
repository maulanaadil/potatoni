import type { MetadataRoute } from "next";

// A private POS + dashboard behind a login: nothing here should be in search results.
// (Link previews still work — crawlers like WhatsApp read Open Graph tags regardless.)
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", disallow: "/" }] };
}
