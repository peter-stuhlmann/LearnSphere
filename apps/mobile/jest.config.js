/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  setupFiles: ["<rootDir>/jest.setup.js"],
  testMatch: ["<rootDir>/src/**/*.test.{ts,tsx}"],
  // jest-expo-Default + Workspace-Packages (rohes TS) und unistyles
  transformIgnorePatterns: [
    "/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|standard-navigation|@elearning|use-intl))",
    "/node_modules/react-native-reanimated/plugin/",
    "/node_modules/@react-native/babel-preset/",
  ],
  collectCoverageFrom: ["src/api/**/*.ts", "src/auth/**/*.ts", "src/i18n.ts"],
  coverageThreshold: {
    // wie im Web: pure Logik hart auf 100 %, Screens per Behavior-Tests
    "src/auth/token-store.ts": {
      lines: 100,
      functions: 100,
      branches: 100,
      statements: 100,
    },
  },
};
