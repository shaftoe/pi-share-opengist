import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    testTimeout: 5000,
    coverage: {
      provider: "v8",
      reporter: ["lcov"],
      include: ["src/**/*"],
      // Runtime glue that only executes inside a full Pi host process.
      exclude: ["src/index.ts", "src/clipboard.ts"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
})
