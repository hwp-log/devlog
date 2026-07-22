import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // 스토리 썸네일(next/image) 최적화 대상 — Supabase Storage public 오브젝트만 허용.
    // 호스트는 env 파생(환경 간 이식). getPublicUrl은 쿼리 없는 URL이므로 search '' 고정.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: process.env.NEXT_PUBLIC_SUPABASE_URL
          ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
          : 'placeholder.supabase.co', // jest 등 env 없는 평가용, 실서빙 불가 호스트
        port: '',
        pathname: '/storage/v1/object/public/**',
        search: '',
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    },
    viewTransition: true,
  },
};

export default nextConfig;
