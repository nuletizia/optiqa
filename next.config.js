/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Lint errors fail the build; stylistic/legacy rules are warnings (see eslint.config.mjs).
    ignoreDuringBuilds: false,
  },
  typescript: {
    // Type errors fail the build.
    ignoreBuildErrors: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.amazonaws.com',
      },
    ],
    unoptimized: true,
  },
}

module.exports = nextConfig 