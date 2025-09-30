/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // So we can expose safe env vars to the browser
  env: {
    NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000",
  },

  async rewrites() {
    return [
      {
        source: "/api/:path*",   // Anything hitting /api/* in Next.js
        destination: `${process.env.NEXT_PUBLIC_BACKEND_URL}/:path*`, 
        // Proxies to backend server
      },
    ]
  },
}

module.exports = nextConfig
