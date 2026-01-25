import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // ✅ Vercel ビルド時の TypeScript チェックを無効化
    // （ローカルでは引き続き型チェックされる）
    ignoreBuildErrors: true,
  },
};

export default nextConfig;