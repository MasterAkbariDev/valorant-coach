import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@google/genai"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "media.valorant-api.com" },
    ],
  },
};

export default nextConfig;
