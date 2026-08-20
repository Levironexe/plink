import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Creators paste their own avatar and cover URLs, so any HTTPS host is fair
    // game. Images are rendered unoptimized to avoid proxying third-party media.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  serverExternalPackages: ["pg", "@prisma/adapter-pg"],
  // Workspace packages ship TypeScript source, so Next compiles them itself.
  transpilePackages: [
    "@plink/ai",
    "@plink/core",
    "@plink/db",
    "@plink/email",
    "@plink/payments",
    "@plink/storage",
    "@plink/ui",
  ],
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
