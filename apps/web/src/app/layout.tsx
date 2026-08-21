import type { Metadata, Viewport } from "next";
import { Google_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";

const googleSans = Google_Sans({
  subsets: ["latin"],
  variable: "--font-google-sans",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
  weight: ["400"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

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
  themeColor: "#171717",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${googleSans.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
