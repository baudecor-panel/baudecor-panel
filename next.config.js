/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {},
  webpack: (config) => {
    config.module.rules.push({
      test: /lightningcss/,
      use: "null-loader",
    });
    return config;
  },
};

module.exports = nextConfig;