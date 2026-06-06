import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: [
    '10.9.23.205',
    'localhost',
    '127.0.0.1',
    'darsi.nrs.hcm-lab.id',
  ],
};

export default nextConfig;
