import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Product photos and brand logos are uploaded through server actions (images up to 5 MB).
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
};

export default config;
