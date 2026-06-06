import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // Pin a single fork so the concurrency target test is deterministic and the
    // suite never hangs on worker-pool quirks across environments. This is repo
    // ergonomics, not a candidate signal.
    pool: "forks",
    fileParallelism: false,
  },
});
