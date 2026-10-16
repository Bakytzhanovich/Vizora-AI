const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The browser calls /api on the site's own domain and Next forwards it to
  // the backend. Called directly, the backend is a different site, and
  // browsers don't send its refresh_token cookie on fetch() — so every
  // session ended after the one-hour access token.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` }];
  },
};

export default nextConfig;
