import { defineConfig } from "vitest/config";

// Config separada: o smoke test exige o build pronto e não entra em `npm test`.
export default defineConfig({
  test: {
    root: ".",
    include: ["src/server/dist.smoke.ts"],
  },
});
