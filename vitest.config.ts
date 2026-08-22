import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: [
      "shared/**/*.test.ts",
      "shared/**/__tests__/**/*.test.ts",
      "deploy/**/__tests__/**/*.test.ts",
      "*/components/lib/__tests__/**/*.test.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text"],
      include: ["shared/**/*.ts"],
      exclude: ["**/*.test.ts", "**/__tests__/**"],
    },
  },
});
