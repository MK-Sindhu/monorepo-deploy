import path from "node:path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["db"],
  output: "standalone",
  outputFileTracingRoot: path.join(import.meta.dirname, "../../"),
};

export default nextConfig;
