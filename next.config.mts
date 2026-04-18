import createNextIntlPlugin from 'next-intl/plugin';

// i18n.ts is at the project root (default location)
const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default withNextIntl(nextConfig);
