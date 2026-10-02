import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // A 5 MB photo plus multipart boundaries must reach the action.
      // The action still rejects files larger than 5 MB.
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
