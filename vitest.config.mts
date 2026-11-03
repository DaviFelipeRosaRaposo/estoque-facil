import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // "server-only" só faz sentido dentro do Next.js; nos testes vira um módulo vazio.
      "server-only": fileURLToPath(new URL("./tests/stubs/vazio.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/setup/banco-global.ts"],
    setupFiles: ["tests/setup/por-arquivo.ts"],
    // Todos os arquivos usam o mesmo banco de teste: um arquivo por vez.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 180_000,
  },
});
