/** @type {import('next').NextConfig} */
const nextConfig = {
  // Transpile wagmi and viem packages
  transpilePackages: ['@wagmi', 'wagmi', 'viem', 'ox'],

  // Ignore type errors in build (for deep type instantiation issues)
  typescript: {
    ignoreBuildErrors: true,
  },

  // Webpack config for polyfills
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
};

export default nextConfig;
