import { beforeEach, describe, expect, it } from "vitest";
import { api, criarProdutoValido, criarUsuario, limparBanco, logarComo, movimentacoesNoBanco, quantidadeNoBanco } from "../helpers";

beforeEach(async () => {
  await limparBanco();
  logarComo(await criarUsuario("a@teste.com"));
});

describe("POST /api/produtos/:id/movimentacoes — entrada e saída", () => {
  it("quando o usuário não está logado, então responde 401", async () => {
    const produto = await criarProdutoValido({ quantidade_inicial: 1 });
    logarComo(null);
    expect((await api.movimentar(produto.id, { tipo: "entrada", quantidade: 1 })).status).toBe(401);
    expect(await quantidadeNoBanco(produto.id)).toBe(1);
  });

  it("quando registra uma entrada, então soma à quantidade e grava o histórico", async () => {
    const produto = await criarProdutoValido({ quantidade_inicial: 2 });
    const r = await api.movimentar(produto.id, { tipo: "entrada", quantidade: 5, observacao: "Compra" });
    expect(r.status).toBe(201);
    expect(r.corpo.produto.quantidade).toBe(7);
    expect((await movimentacoesNoBanco(produto.id)).at(-1)).toMatchObject({ tipo: "entrada", quantidade: 5, observacao: "Compra" });
  });

  it("quando registra uma saída com saldo, então subtrai", async () => {
    const produto = await criarProdutoValido({ quantidade_inicial: 10 });
    const r = await api.movimentar(produto.id, { tipo: "saida", quantidade: 4 });
    expect(r.status).toBe(201);
    expect(r.corpo.produto.quantidade).toBe(6);
  });

  it("quando a saída é exatamente igual ao saldo, então o estoque fica zerado (limite)", async () => {
    const produto = await criarProdutoValido({ quantidade_inicial: 3 });
    const r = await api.movimentar(produto.id, { tipo: "saida", quantidade: 3 });
    expect(r.status).toBe(201);
    expect(r.corpo.produto).toMatchObject({ quantidade: 0, estoque_baixo: true });
  });

  it("quando a saída é maior que o saldo, então responde 409 e nada muda", async () => {
    const produto = await criarProdutoValido({ quantidade_inicial: 3 });
    const r = await api.movimentar(produto.id, { tipo: "saida", quantidade: 4 });
    expect(r.status).toBe(409);
    expect(r.corpo.erro).toBe("Estoque insuficiente para essa saída.");
    expect(await quantidadeNoBanco(produto.id)).toBe(3);
    expect(await movimentacoesNoBanco(produto.id)).toHaveLength(1);
  });

  it("quando o estoque está zerado e tenta saída, então responde 409", async () => {
    const produto = await criarProdutoValido();
    expect((await api.movimentar(produto.id, { tipo: "saida", quantidade: 1 })).status).toBe(409);
  });

  it.each([
    [{ tipo: "entrada", quantidade: 0 }, "quantidade"],
    [{ tipo: "entrada", quantidade: -2 }, "quantidade"],
    [{ tipo: "saida", quantidade: 1.5 }, "quantidade"],
    [{ tipo: "ajuste", quantidade: 1 }, "tipo"],
    [{ tipo: "entrada", quantidade: 1, observacao: "x".repeat(201) }, "observacao"],
  ])("quando o corpo é inválido (%j), então responde 400 no campo %s", async (corpo, campo) => {
    const produto = await criarProdutoValido({ quantidade_inicial: 5 });
    const r = await api.movimentar(produto.id, corpo);
    expect(r.status).toBe(400);
    expect(Object.keys(r.corpo.campos)).toEqual([campo]);
    expect(await quantidadeNoBanco(produto.id)).toBe(5);
  });

  it("quando o produto não existe, então responde 404", async () => {
    const r = await api.movimentar("00000000-0000-0000-0000-000000000000", { tipo: "entrada", quantidade: 1 });
    expect(r.status).toBe(404);
  });
});

describe("Movimentações simultâneas (race condition)", () => {
  it("quando duas saídas do último item chegam ao mesmo tempo, então só uma é aceita e o estoque termina em 0", async () => {
    const produto = await criarProdutoValido({ quantidade_inicial: 1 });
    const respostas = await Promise.all([
      api.movimentar(produto.id, { tipo: "saida", quantidade: 1 }),
      api.movimentar(produto.id, { tipo: "saida", quantidade: 1 }),
    ]);
    expect(respostas.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await quantidadeNoBanco(produto.id)).toBe(0);
    expect((await movimentacoesNoBanco(produto.id)).filter((m) => m.tipo === "saida")).toHaveLength(1);
  });

  it("quando dez saídas chegam ao mesmo tempo com saldo 5, então exatamente 5 passam e o histórico bate", async () => {
    const produto = await criarProdutoValido({ quantidade_inicial: 5 });
    const respostas = await Promise.all(
      Array.from({ length: 10 }, () => api.movimentar(produto.id, { tipo: "saida", quantidade: 1 }))
    );
    expect(respostas.filter((r) => r.status === 201)).toHaveLength(5);
    expect(respostas.filter((r) => r.status === 409)).toHaveLength(5);
    expect(await quantidadeNoBanco(produto.id)).toBe(0);
    expect((await movimentacoesNoBanco(produto.id)).filter((m) => m.tipo === "saida")).toHaveLength(5);
  });

  it("quando entradas e saídas simultâneas acontecem, então o saldo final é exatamente a soma de todas", async () => {
    const produto = await criarProdutoValido({ quantidade_inicial: 20 });
    await Promise.all([
      ...Array.from({ length: 6 }, () => api.movimentar(produto.id, { tipo: "entrada", quantidade: 3 })),
      ...Array.from({ length: 6 }, () => api.movimentar(produto.id, { tipo: "saida", quantidade: 2 })),
    ]);
    expect(await quantidadeNoBanco(produto.id)).toBe(20 + 18 - 12);
  });
});
