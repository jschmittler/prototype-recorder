import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const src = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@ptw/job-contracts": src("./packages/job-contracts/src/index.ts"),
      "@ptw/engine-adapter": src("./packages/engine-adapter/src/index.ts"),
      "@ptw/script-generator": src("./packages/script-generator/src/index.ts"),
    },
  },
  test: {
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts"],
    environment: "node",
  },
});
