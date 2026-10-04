import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.e2e-spec.ts", "src/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    pool: "forks",
    fileParallelism: false,
    env: {
      DOCUMIND_FAKE_PROVIDERS: "1",
      DOCUMIND_MASTER_KEY: "9d1d7a24d37c05f48d97e43f8ceb9f14b4c6a3fb6f4b1a0a2b6f4d1b8cf7e2a1",
    },
  },
});
