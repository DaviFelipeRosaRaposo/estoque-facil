import { beforeEach, describe, expect, it } from "vitest";
import { api, criarProdutoValido, criarUsuario, limparBanco, logarComo, movimentacoesNoBanco, quantidadeNoBanco, bancoAdmin } from "../helpers";

let usuarioA: string;

beforeEach(async () => {
  await limparBanco();
  usuarioA = await criarUsuario("a@teste.com");
  logarComo(usuarioA);
});

describe("POST /api/produtos — cadastro de produto", () => {
  it("quando o usuário não está logado, então responde 401 e nada é gravado", async () => {
    logarComo(null);
    const r = await api.criar({ nome: "Caneta", preco: 1 });
    expect(r.status).toBe(401);
    expect(r.corpo.erro).toBe("Faça login para continuar.");
    const { rows } = await bancoAdmin().query("select count(*)::int as n from public.produtos");
    expect(rows[0].n).toBe(0);
  });

  it("quando os dados são válidos, então responde 201, grava com o usuário da sessão como dono e calcula estoque_baixo", async () => {
    const r = await api.criar({ nome: "  Caderno  ", categoria: "Papelaria", preco: "12,90", estoque_minimo: 2 });
    expect(r.status).toBe(201);
    expect(r.corpo.produto).toMatchObject({
      nome: "Caderno",
      categoria: "Papelaria",
      preco: 12.9,
      quantidade: 0,
      estoque_minimo: 2,
      estoque_baixo: true,
    });
    const { rows } = await bancoAdmin().query("select user_id from public.produtos where id = $1", [r.corpo.produto.id]);
    expect(rows[0].user_id).toBe(usuarioA);
  });

  it('quando informa quantidade inicial, então cria uma movimentação de entrada "Estoque inicial"', async () => {
    const produto = await criarProdutoValido({ quantidade_inicial: 10 });
    expect(produto.quantidade).toBe(10);
    expect(produto.estoque_baixo).toBe(false);
    expect(await movimentacoesNoBanco(produto.id)).toEqual([
      { tipo: "entrada", quantidade: 10, observacao: "Estoque inicial", user_id: usuarioA },
    ]);
  });

  it("quando o nome está vazio ou o preço é negativo, então responde 400 com a mensagem de cada campo", async () => {
    const r = await api.criar({ nome: "   ", preco: -1 });
    expect(r.status).toBe(400);
    expect(r.corpo.campos).toEqual({
      nome: "Informe o nome do produto.",
      preco: "O preço não pode ser negativo.",
    });
  });

  it("quando o preço não é número, então responde 400", async () => {
    const r = await api.criar({ nome: "Caneta", preco: "abc" });
    expect(r.status).toBe(400);
    expect(r.corpo.campos.preco).toBe("Informe um preço válido.");
  });

  it("quando a quantidade inicial é decimal ou negativa, então responde 400", async () => {
    expect((await api.criar({ nome: "A", preco: 1, quantidade_inicial: 1.5 })).corpo.campos.quantidade_inicial).toBe(
      "A quantidade inicial deve ser um número inteiro."
    );
    expect((await api.criar({ nome: "A", preco: 1, quantidade_inicial: -3 })).corpo.campos.quantidade_inicial).toBe(
      "A quantidade inicial não pode ser menor que zero."
    );
  });

  it("quando o nome passa de 100 caracteres, então responde 400", async () => {
    const r = await api.criar({ nome: "x".repeat(101), preco: 1 });
    expect(r.status).toBe(400);
    expect(r.corpo.campos.nome).toBe("O nome deve ter no máximo 100 caracteres.");
  });

  it("quando o corpo não é JSON, então responde 400", async () => {
    const r = await api.criar("isto não é json");
    expect(r.status).toBe(400);
    expect(r.corpo.erro).toBe("Corpo da requisição inválido.");
  });

  it("quando o cliente envia user_id de outro usuário, então o servidor ignora e o dono é quem está logado", async () => {
    const usuarioB = await criarUsuario("b@teste.com");
    const r = await api.criar({ nome: "Cola", preco: 3, user_id: usuarioB, quantidade: 999 });
    expect(r.status).toBe(201);
    expect(r.corpo.produto.quantidade).toBe(0);
    const { rows } = await bancoAdmin().query("select user_id from public.produtos where id = $1", [r.corpo.produto.id]);
    expect(rows[0].user_id).toBe(usuarioA);
  });

  it("quando o preço é zero, então aceita (limite válido)", async () => {
    const r = await api.criar({ nome: "Brinde", preco: 0 });
    expect(r.status).toBe(201);
    expect(r.corpo.produto.preco).toBe(0);
  });
});

describe("GET /api/produtos — listagem, busca e resumo", () => {
  it("quando o usuário não está logado, então responde 401", async () => {
    logarComo(null);
    expect((await api.listar()).status).toBe(401);
  });

  it("quando o usuário tem produtos, então lista os dele com total, alertas e valor em estoque", async () => {
    await criarProdutoValido({ nome: "Borracha", preco: 1.5, quantidade_inicial: 10, estoque_minimo: 2 });
    await criarProdutoValido({ nome: "apontador", preco: 4, quantidade_inicial: 1, estoque_minimo: 5 });
    const r = await api.listar();
    expect(r.status).toBe(200);
    expect(r.corpo.produtos.map((p: { nome: string }) => p.nome)).toEqual(["apontador", "Borracha"]);
    expect(r.corpo.resumo).toEqual({ total_produtos: 2, em_alerta: 1, valor_total: 19 });
  });

  it("quando busca por parte do nome ou da categoria, então filtra sem diferenciar maiúsculas", async () => {
    await criarProdutoValido({ nome: "Caneta azul", categoria: "Papelaria" });
    await criarProdutoValido({ nome: "Detergente", categoria: "Limpeza" });
    expect((await api.listar("CANETA")).corpo.produtos).toHaveLength(1);
    expect((await api.listar("limp")).corpo.produtos[0].nome).toBe("Detergente");
  });

  it("quando a busca contém %, então trata como texto e não como curinga", async () => {
    await criarProdutoValido({ nome: "Caneta" });
    expect((await api.listar("%")).corpo.produtos).toHaveLength(0);
  });

  it("quando a quantidade é igual ao mínimo, então marca como estoque baixo (limite)", async () => {
    await criarProdutoValido({ quantidade_inicial: 3, estoque_minimo: 3 });
    await criarProdutoValido({ nome: "Outro", quantidade_inicial: 4, estoque_minimo: 3 });
    const { produtos } = (await api.listar()).corpo;
    expect(produtos.find((p: { nome: string }) => p.nome === "Caneta azul").estoque_baixo).toBe(true);
    expect(produtos.find((p: { nome: string }) => p.nome === "Outro").estoque_baixo).toBe(false);
  });
});

describe("GET /api/produtos/:id — detalhe", () => {
  it("quando o produto é do usuário, então devolve os dados e o histórico do mais recente para o mais antigo", async () => {
    const produto = await criarProdutoValido({ quantidade_inicial: 5 });
    await api.movimentar(produto.id, { tipo: "saida", quantidade: 2, observacao: "Venda" });
    const r = await api.obter(produto.id);
    expect(r.status).toBe(200);
    expect(r.corpo.produto.quantidade).toBe(3);
    expect(r.corpo.historico.map((m: { tipo: string; quantidade: number }) => [m.tipo, m.quantidade])).toEqual([
      ["saida", 2],
      ["entrada", 5],
    ]);
  });

  it("quando o id não existe ou é malformado, então responde 404", async () => {
    expect((await api.obter("00000000-0000-0000-0000-000000000000")).status).toBe(404);
    expect((await api.obter("abc")).status).toBe(404);
  });
});

describe("PATCH /api/produtos/:id — edição", () => {
  it("quando os dados são válidos, então atualiza nome, categoria, preço e mínimo", async () => {
    const produto = await criarProdutoValido();
    const r = await api.editar(produto.id, { nome: "Caneta preta", categoria: "", preco: 3, estoque_minimo: 0 });
    expect(r.status).toBe(200);
    expect(r.corpo.produto).toMatchObject({ nome: "Caneta preta", categoria: null, preco: 3, estoque_minimo: 0 });
  });

  it("quando o corpo traz quantidade, então ela é ignorada e o estoque não muda", async () => {
    const produto = await criarProdutoValido({ quantidade_inicial: 4 });
    const r = await api.editar(produto.id, { nome: "Caneta", preco: 2, estoque_minimo: 1, quantidade: 1000 });
    expect(r.status).toBe(200);
    expect(await quantidadeNoBanco(produto.id)).toBe(4);
  });

  it("quando o estoque mínimo é negativo, então responde 400", async () => {
    const produto = await criarProdutoValido();
    const r = await api.editar(produto.id, { nome: "Caneta", preco: 2, estoque_minimo: -1 });
    expect(r.status).toBe(400);
    expect(r.corpo.campos.estoque_minimo).toBe("O estoque mínimo não pode ser menor que zero.");
  });

  it("quando o produto não existe, então responde 404", async () => {
    const r = await api.editar("00000000-0000-0000-0000-000000000000", { nome: "X", preco: 1 });
    expect(r.status).toBe(404);
  });
});

describe("DELETE /api/produtos/:id — exclusão", () => {
  it("quando o produto é do usuário, então responde 204 e apaga o produto e o histórico", async () => {
    const produto = await criarProdutoValido({ quantidade_inicial: 2 });
    const r = await api.excluir(produto.id);
    expect(r.status).toBe(204);
    expect(await quantidadeNoBanco(produto.id)).toBeUndefined();
    expect(await movimentacoesNoBanco(produto.id)).toEqual([]);
  });

  it("quando repete a exclusão (clicou 2 vezes), então a segunda responde 404 e nada quebra", async () => {
    const produto = await criarProdutoValido();
    const [r1, r2] = await Promise.all([api.excluir(produto.id), api.excluir(produto.id)]);
    expect([r1.status, r2.status].sort()).toEqual([204, 404]);
  });
});
