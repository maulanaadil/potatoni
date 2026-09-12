import type { Metadata, Viewport } from "next";
import { Baloo_2, Nunito } from "next/font/google";
import { Toaster } from "sonner";
import { Providers } from "@/components/providers";
import "./globals.css";

const baloo = Baloo_2({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-baloo",
});
const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito" });

const description =
  "Crispy outside, happy inside. The Potatoni register and owner dashboard — fries, pom-pom and chicken bites in Bandung.";

export const metadata: Metadata = {
  // Absolute URLs for share images; set APP_URL to the deployed domain.
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: { default: "Potatoni", template: "%s · Potatoni" },
  description,
  applicationName: "Potatoni",
  keywords: ["Potatoni", "fries", "pom-pom", "chicken bites", "Bandung", "POS"],
  // Private app behind a login (see robots.ts). Flip to index: true for a public landing page.
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Potatoni", statusBarStyle: "default" },
  formatDetection: { telephone: false, email: false, address: false },
  openGraph: {
    type: "website",
    siteName: "Potatoni",
    title: "Potatoni — Crispy outside, happy inside.",
    description,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Potatoni — Crispy outside, happy inside.",
    description,
  },
};

export const viewport: Viewport = {
  themeColor: "#f8f1e6",
  colorScheme: "light",
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${baloo.variable} ${nunito.variable}`}>
      <body className="min-h-dvh bg-cream font-sans text-navy antialiased selection:bg-sun">
        <Providers>{children}</Providers>
        <Toaster
          position="top-center"
          toastOptions={{
            classNames: {
              toast: "!rounded-2xl !border-2 !border-navy !bg-paper !font-sans !text-navy",
              title: "!font-bold",
            },
          }}
        />
      </body>
    </html>
  );
}
