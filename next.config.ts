import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Type errors fail the build again. They were previously ignored, so a broken
  // type could ship to production unnoticed. `examples/` is excluded in
  // tsconfig.json because those samples reference optional socket.io packages.
  reactStrictMode: true,
};

export default nextConfig;
