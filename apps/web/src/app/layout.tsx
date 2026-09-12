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

export const metadata: Metadata = {
  title: { default: "Potatoni", template: "%s · Potatoni" },
  description: "Crispy outside, happy inside.",
  appleWebApp: { capable: true, title: "Potatoni", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#f8f1e6",
  viewportFit: "cover",
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
