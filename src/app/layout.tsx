import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans, Fraunces } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
  weight: ["500", "600", "700", "800"],
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["SOFT", "WONK"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Plink — the link in bio built for creators",
    template: "%s · Plink",
  },
  description:
    "Plink is the all-in-one creator platform: a link in bio, store, email list, media kit and analytics — live in under two minutes.",
  keywords: ["link in bio", "creator platform", "media kit", "creator store", "link tree"],
  openGraph: {
    title: "Plink — the link in bio built for creators",
    description:
      "One link for everything you make, sell and share. Build a page, grow an audience, get paid.",
    url: siteUrl,
    siteName: "Plink",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Plink — the link in bio built for creators",
    description: "One link for everything you make, sell and share.",
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#6c4cff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jakarta.variable} ${fraunces.variable}`}>
      <body>{children}</body>
    </html>
  );
}
