import { beforeEach, describe, expect, it } from "vitest";
import { bancoAdmin, criarUsuario, limparBanco } from "../helpers";

/**
 * Simula quem acessa o banco direto, sem passar pelas rotas do app:
 * - anon / authenticated: o que a API pública do Supabase (PostgREST) usaria
 *   com a chave publishable que está no navegador;
 * - estoque_app: o papel do servidor, para provar que nem ele altera a
 *   quantidade sem a função atômica.
 */
async function comoPapel(papel: string, usuarioId: string | null, sql: string, params: unknown[] = []) {
  const client = await bancoAdmin().connect();
  try {
    await client.query("begin");
    await client.query(`set local role ${papel}`);
    if (usuarioId) {
      await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: usuarioId })]);
      await client.query("select set_config('app.usuario_id', $1, true)", [usuarioId]);
    }
    return await client.query(sql, params);
  } finally {
    await client.query("rollback");
    client.release();
  }
}

let usuario: string;
let produtoId: string;

beforeEach(async () => {
  await limparBanco();
  usuario = await criarUsuario("a@teste.com");
  const { rows } = await bancoAdmin().query(
    "insert into public.produtos (user_id, nome, preco, quantidade) values ($1, 'Caneta', 2, 5) returning id",
    [usuario]
  );
  produtoId = rows[0].id;
  await bancoAdmin().query(
    "insert into public.movimentacoes (produto_id, user_id, tipo, quantidade) values ($1, $2, 'entrada', 5)",
    [produtoId, usuario]
  );
});

describe("Banco exposto pela API do Supabase (policies e privilégios)", () => {
  it("quando um visitante (anon) tenta ler movimentações, então o banco nega", async () => {
    await expect(comoPapel("anon", null, "select * from public.movimentacoes")).rejects.toThrow(/permission denied/);
  });

  it("quando o próprio dono (authenticated) tenta ler produtos direto pela API, então o banco nega", async () => {
    await expect(comoPapel("authenticated", usuario, "select * from public.produtos")).rejects.toThrow(/permission denied/);
  });

  it("quando authenticated tenta inserir movimentação direto, então o banco nega", async () => {
    await expect(
      comoPapel(
        "authenticated",
        usuario,
        "insert into public.movimentacoes (produto_id, user_id, tipo, quantidade) values ($1, $2, 'saida', 1)",
        [produtoId, usuario]
      )
    ).rejects.toThrow(/permission denied/);
  });

  it("quando authenticated tenta alterar a quantidade direto, então o banco nega", async () => {
    await expect(
      comoPapel("authenticated", usuario, "update public.produtos set quantidade = 999 where id = $1", [produtoId])
    ).rejects.toThrow(/permission denied/);
  });

  it("quando o servidor (estoque_app) tenta alterar a quantidade sem a função de movimentação, então o banco nega", async () => {
    await expect(
      comoPapel("estoque_app", usuario, "update public.produtos set quantidade = 999 where id = $1", [produtoId])
    ).rejects.toThrow(/permission denied/);
  });

  it("quando o servidor tenta inserir movimentação direto na tabela, então o banco nega", async () => {
    await expect(
      comoPapel(
        "estoque_app",
        usuario,
        "insert into public.movimentacoes (produto_id, user_id, tipo, quantidade) values ($1, $2, 'saida', 1)",
        [produtoId, usuario]
      )
    ).rejects.toThrow(/permission denied/);
  });

  it("quando estoque_app roda sem usuário definido, então não enxerga nenhuma linha", async () => {
    const r = await comoPapel("estoque_app", null, "select * from public.produtos");
    expect(r.rows).toEqual([]);
  });

  it("quando o servidor tenta apagar o histórico, então o banco nega", async () => {
    await expect(
      comoPapel("estoque_app", usuario, "delete from public.movimentacoes where produto_id = $1", [produtoId])
    ).rejects.toThrow(/permission denied/);
  });

  it("quando o banco recebe preço ou quantidade negativos por fora do servidor, então as constraints recusam", async () => {
    await expect(
      bancoAdmin().query("insert into public.produtos (user_id, nome, preco) values ($1, 'X', -1)", [usuario])
    ).rejects.toThrow(/produtos_preco_nao_negativo/);
    await expect(
      bancoAdmin().query("update public.produtos set quantidade = -1 where id = $1", [produtoId])
    ).rejects.toThrow(/produtos_quantidade_nao_negativa/);
  });
});
