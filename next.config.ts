import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  devIndicators: false,
  async redirects() {
    return [
      // /sign-in was renamed to /login -- keep old bookmarks/links working.
      { source: "/sign-in", destination: "/login", permanent: true },
    ];
  },
};

export default nextConfig;
