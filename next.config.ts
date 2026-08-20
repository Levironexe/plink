import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Creators paste their own avatar and cover URLs, so any HTTPS host is fair
    // game. Images are rendered unoptimized to avoid proxying third-party media.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  serverExternalPackages: ["better-sqlite3", "@prisma/adapter-better-sqlite3"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
