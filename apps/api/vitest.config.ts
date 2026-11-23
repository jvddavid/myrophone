import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Auth flow tests share one database and clean up every "@auth-test.local"
    // user and "Auth Test" tenant, so test files must not run concurrently.
    fileParallelism: false,
  },
});
