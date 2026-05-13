import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
      },
      {
        protocol: 'https',
        hostname: 'img.youtube.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'static.coupangcdn.com',
      },
      {
        protocol: 'https',
        hostname: 'thumbnail10.coupangcdn.com',
      },
      {
        protocol: 'https',
        hostname: 'thumbnail9.coupangcdn.com',
      },
      {
        protocol: 'https',
        hostname: 'thumbnail8.coupangcdn.com',
      },
      {
        protocol: 'https',
        hostname: 'thumbnail7.coupangcdn.com',
      },
    ],
  },
};

export default nextConfig;

import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
