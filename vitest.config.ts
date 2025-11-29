import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: [
      "test/backend/**/*.test.ts",
      "server/**/__tests__/**/*.test.ts",
    ],
    exclude: [
      "node_modules",
      "dist",
      "client/**/*",
      "test/*.test.ts",
      "test/integration/**/*.test.ts",
    ],
    setupFiles: ["./test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      reportsDirectory: "./coverage",
      include: [
        "server/**/*.ts",
        "shared/**/*.ts",
      ],
      exclude: [
        "server/vite.ts",
        "server/index.ts",
        "**/*.test.ts",
        "**/__tests__/**",
        "**/node_modules/**",
      ],
      thresholds: {
        statements: 20,
        branches: 20,
        functions: 20,
        lines: 20,
      },
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./server"),
      "@shared": path.resolve(__dirname, "./shared"),
      "@test": path.resolve(__dirname, "./test"),
    },
  },
});
