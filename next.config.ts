import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['got-scraping', 'cheerio'],
};

export default nextConfig;
