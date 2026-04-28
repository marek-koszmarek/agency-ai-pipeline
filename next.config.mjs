/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  // Increase body parser limit for API routes
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};
export default nextConfig;
