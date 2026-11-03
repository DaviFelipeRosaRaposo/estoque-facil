import { afterAll, inject, vi } from "vitest";
import { encerrarPool } from "@/lib/server/db";

// O servidor do app usa o banco de TESTE.
process.env.DATABASE_URL = inject("urlBancoTeste");
process.env.DATABASE_POOL_MAX = "10";

// Único mock: o Supabase Auth (serviço externo). Cada teste define quem está logado.
vi.mock("@/lib/server/auth", () => ({ obterUsuarioId: vi.fn(async () => null) }));

afterAll(async () => {
  await encerrarPool();
});
