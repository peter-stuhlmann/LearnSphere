import path from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Monorepo: Workspace-Root liegt zwei Ebenen über apps/web
const workspaceRoot = path.join(__dirname, "../..");

const nextConfig: NextConfig = {
  // Self-Hosting (Docker/Hostinger): minimales Server-Bundle inkl. server.js
  output: "standalone",
  turbopack: {
    root: workspaceRoot,
  },
  // File-Tracing muss gehoistete node_modules im Workspace-Root einsammeln,
  // sonst fehlen Serverless-Funktionen auf Vercel Module zur Laufzeit
  outputFileTracingRoot: workspaceRoot,
  // Workspace-Packages liegen als rohes TypeScript vor (kein Build-Step)
  transpilePackages: [
    "@elearning/tokens",
    "@elearning/i18n",
    "@elearning/core",
    "@elearning/api-contracts",
  ],
  env: {
    /* Build-Zeitpunkt: dient statischen Seiten in der Sitemap als ehrliches
       <lastmod> – geändert haben können sie sich nur durch ein Deploy */
    NEXT_PUBLIC_BUILD_TIMESTAMP: new Date().toISOString(),
  },
  // nicht bündeln: liefert einen echten Dateipfad zum ffmpeg-Binary,
  // der nach dem Bundling sonst ins Leere zeigen würde
  serverExternalPackages: ["ffmpeg-static"],
  compiler: {
    styledComponents: true,
  },
  experimental: {
    viewTransition: true,
  },
  async redirects() {
    return [
      // Alte Studio-URLs: /dashboard → /creator (Lesezeichen bleiben gültig)
      {
        source: "/:locale(de|en)/dashboard",
        destination: "/:locale/creator",
        permanent: true,
      },
      {
        source: "/:locale(de|en)/dashboard/:path*",
        destination: "/:locale/creator/:path*",
        permanent: true,
      },
    ];
  },
  async headers() {
    const base = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
    ];
    return [
      {
        // Embed-Widget darf überall eingebettet werden
        source: "/embed/:path*",
        headers: [
          ...base,
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
        ],
      },
      {
        // Rest der App: Einbetten durch Fremdseiten verboten (Clickjacking)
        source: "/((?!embed).*)",
        headers: [
          ...base,
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
