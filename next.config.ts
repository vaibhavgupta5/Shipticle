import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  transpilePackages: ["firebase-admin", "jwks-rsa"],
};

export default nextConfig;
