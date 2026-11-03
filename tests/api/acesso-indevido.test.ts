import { beforeEach, describe, expect, it } from "vitest";
import { api, criarProdutoValido, criarUsuario, limparBanco, logarComo, movimentacoesNoBanco, quantidadeNoBanco, bancoAdmin } from "../helpers";

let produtoDeA: { id: string };
let usuarioB: string;

beforeEach(async () => {
  await limparBanco();
  logarComo(await criarUsuario("a@teste.com"));
  produtoDeA = await criarProdutoValido({ nome: "Produto da A", quantidade_inicial: 5 });
  usuarioB = await criarUsuario("b@teste.com");
  logarComo(usuarioB);
});

describe("Acesso indevido — usuário B tentando mexer nos dados do usuário A", () => {
  it("quando B lista produtos, então não vê nenhum produto de A e o resumo é só dele", async () => {
    const r = await api.listar();
    expect(r.corpo.produtos).toEqual([]);
    expect(r.corpo.resumo).toEqual({ total_produtos: 0, em_alerta: 0, valor_total: 0 });
  });

  it("quando B tenta ler o produto de A, então responde 404", async () => {
    expect((await api.obter(produtoDeA.id)).status).toBe(404);
  });

  it("quando B tenta editar o produto de A, então responde 404 e o produto não muda", async () => {
    const r = await api.editar(produtoDeA.id, { nome: "Hackeado", preco: 0 });
    expect(r.status).toBe(404);
    const { rows } = await bancoAdmin().query("select nome from public.produtos where id = $1", [produtoDeA.id]);
    expect(rows[0].nome).toBe("Produto da A");
  });

  it("quando B tenta excluir o produto de A, então responde 404 e o produto continua existindo", async () => {
    expect((await api.excluir(produtoDeA.id)).status).toBe(404);
    expect(await quantidadeNoBanco(produtoDeA.id)).toBe(5);
  });

  it("quando B tenta registrar saída no produto de A, então responde 404 e o estoque de A não muda", async () => {
    const r = await api.movimentar(produtoDeA.id, { tipo: "saida", quantidade: 5 });
    expect(r.status).toBe(404);
    expect(await quantidadeNoBanco(produtoDeA.id)).toBe(5);
    expect(await movimentacoesNoBanco(produtoDeA.id)).toHaveLength(1);
  });
});
