import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow service worker to be served from public/
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Service-Worker-Allowed", value: "/" },
          { key: "Cache-Control", value: "no-cache" },
        ],
      },
    ];
  },
};

export default nextConfig;
