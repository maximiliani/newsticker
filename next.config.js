/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: 'standalone',
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
      allowedOrigins: [
        'localhost:3000',
        'localhost',
        '127.0.0.1:3000',
        '127.0.0.1',
      ],
    },
  },
};

module.exports = nextConfig;
