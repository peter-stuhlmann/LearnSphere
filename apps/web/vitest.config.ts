import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { createRequire } from "node:module";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/lib/**"],
      exclude: [
        "**/*.d.ts",
        "**/index.ts",
        // Infrastruktur-Glue ohne Domain-Logik: per E2E-Test abgedeckt
        "src/lib/db.ts",
        // Service-Schicht: Orchestrierung (auth()/Prisma) für Actions UND
        // Mobile-REST-Routen; die Regeln liegen in @elearning/core bzw. lib/*
        "src/lib/services/**",
        // Store-Verifikations-Glue (Apple JWS / Play API) – wie stripe.ts
        "src/lib/iap/**",
        "src/lib/mail.ts",
        "src/lib/rate-limit.ts",
        "src/lib/api-auth.ts",
        "src/lib/payout-server.ts",
        // Mail-/DB-Glue wie payout-server: per E2E abgedeckt
        "src/lib/waitlist-server.ts",
        "src/lib/creator-stats.ts",
        "src/lib/stripe.ts",
        "src/lib/fulfillment.ts",
        "src/lib/ai-grading.ts",
        "src/lib/affiliate-server.ts",
        "src/lib/ai-usage-server.ts",
        "src/lib/rating-server.ts",
        "src/lib/transcribe.ts",
        "src/lib/translate.ts",
        "src/lib/moderation.ts",
        "src/lib/assistant/indexer.ts",
        "src/lib/youtube-server.ts",
        "src/lib/registry.tsx",
        "src/lib/certificate/CertificateDocument.tsx",
      ],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      /* Monorepo: react/react-dom hart auf die aus DIESEM Workspace
         auflösbaren Kopien pinnen – der Root hält wegen anderer Workspaces
         abweichende react-Versionen vor, und react-dom verlangt exakt
         dieselbe react-Version. require.resolve folgt der echten
         npm-Ablage (mal genestet, mal gehoistet). */
      "react-dom": path.dirname(
        createRequire(import.meta.url).resolve("react-dom/package.json")
      ),
      react: path.dirname(
        createRequire(import.meta.url).resolve("react/package.json")
      ),
    },
  },
});
