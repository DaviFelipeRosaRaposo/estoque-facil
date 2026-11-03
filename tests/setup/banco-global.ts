/**
 * Sobe o banco de TESTE antes de todos os testes e aplica as migrations.
 *
 * - Sem TEST_DATABASE_URL: inicia um PostgreSQL embutido (embedded-postgres)
 *   numa pasta temporária, que é apagada no fim. Não precisa de Docker.
 * - Com TEST_DATABASE_URL: usa esse banco, que é APAGADO e recriado.
 *
 * Por segurança, recusa qualquer URL do Supabase e exige "test" no nome do banco.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    urlBancoTeste: string;
  }
}

const RAIZ = fileURLToPath(new URL("../..", import.meta.url));

export function garantirBancoDeTeste(url: string) {
  const u = new URL(url);
  if (/supabase\.(co|com)$/i.test(u.hostname) || u.hostname.includes("pooler.supabase")) {
    throw new Error("Recusado: TEST_DATABASE_URL aponta para o Supabase. Os testes só rodam em banco de teste local.");
  }
  if (!/test/i.test(u.pathname)) {
    throw new Error('Recusado: o nome do banco de teste precisa conter "test" (ex.: estoque_test).');
  }
}

async function aplicarSchema(url: string) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    // Recria do zero para cada execução.
    await client.query("drop schema if exists app cascade; drop schema if exists auth cascade;");
    await client.query("drop schema if exists public cascade; create schema public;");
    await client.query(fs.readFileSync(path.join(RAIZ, "tests/db/supabase-stub.sql"), "utf8"));
    const pasta = path.join(RAIZ, "supabase/migrations");
    for (const arquivo of fs.readdirSync(pasta).filter((f) => f.endsWith(".sql")).sort()) {
      await client.query(fs.readFileSync(path.join(pasta, arquivo), "utf8"));
    }
  } finally {
    await client.end();
  }
}

export default async function setup(project: TestProject) {
  let url = process.env.TEST_DATABASE_URL;
  let embutido: EmbeddedPostgres | null = null;
  let pasta: string | null = null;

  if (!url) {
    const porta = Number(process.env.TEST_DB_PORT ?? 54329);
    // A pasta é criada pelo próprio embedded-postgres.
    pasta = path.join(os.tmpdir(), `estoque-facil-test-${process.pid}-${Date.now()}`);
    embutido = new EmbeddedPostgres({
      databaseDir: pasta,
      port: porta,
      user: "postgres",
      password: "postgres",
      persistent: false,
      autoRehydrateSymlinks: true,
      onLog: () => {},
      onError: () => {},
    });
    await embutido.initialise();
    await embutido.start();
    await embutido.createDatabase("estoque_test");
    url = `postgresql://postgres:postgres@localhost:${porta}/estoque_test`;
  }

  garantirBancoDeTeste(url);
  await aplicarSchema(url);
  project.provide("urlBancoTeste", url);

  return async () => {
    if (embutido) await embutido.stop();
    if (pasta) fs.rmSync(pasta, { recursive: true, force: true });
  };
}
