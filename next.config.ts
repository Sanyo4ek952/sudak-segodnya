import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [{
      source: "/:path*",
      headers: [{
        key: "Content-Security-Policy",
        value: "frame-src 'self' https://vk.com https://www.vk.com https://vk.ru https://www.vk.ru https://vkvideo.ru https://www.vkvideo.ru;"
      }]
    }];
  },
  images: {
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== "production",
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com"
      },
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/**"
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "54321",
        pathname: "/storage/v1/object/**"
      }
    ]
  }
};

export default nextConfig;
