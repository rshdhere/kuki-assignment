/** @type {import('next').NextConfig} */
const nextConfig = {
  // The floating dev-tools badge sits on top of the sidebar.
  devIndicators: false,
  // The website opens on the financial year; Documents lives at /documents.
  redirects() {
    return [{ source: "/", destination: "/financial-year", permanent: false }];
  },
};

export default nextConfig;
