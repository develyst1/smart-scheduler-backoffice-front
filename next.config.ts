import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  allowedDevOrigins: [
    "localhost",
    "154.197.124.206",
  ],
};

export default nextConfig;
