import path from "node:path";
import type { NextConfig } from "next";

/**
 * Same-origin proxy so HttpOnly auth cookies work when the real API is on
 * another host (ngrok HTTPS, Railway, etc.). Browser calls /api-proxy/* on
 * :3001; Next rewrites to NEXT_PUBLIC_API_URL.
 */
const apiTarget = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);

const nextConfig: NextConfig = {
  // Lean production image for Docker (copies .next/standalone + static assets)
  output: "standalone",
  // Pin the workspace root to Frontend/. The monorepo has a second lockfile at
  // the repo root (husky/lint-staged), which otherwise makes Turbopack infer
  // the wrong root and produce a broken React Client Manifest.
  turbopack: {
    root: path.resolve(__dirname),
  },
  async rewrites() {
    return [
      {
        source: "/api-proxy/:path*",
        destination: `${apiTarget}/:path*`,
      },
    ];
  },
};

export default nextConfig;
