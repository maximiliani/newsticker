/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [{
      protocol: 'https',
      hostname: '**',
    }, {
        protocol: 'http',
        hostname: 'localhost',
    }, {
        protocol: 'http',
        hostname: 'kong',
    }, {
        protocol: 'http',
        hostname: 'storage',
    }],
  },
  reactStrictMode: true,
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  },
};

module.exports = nextConfig;
