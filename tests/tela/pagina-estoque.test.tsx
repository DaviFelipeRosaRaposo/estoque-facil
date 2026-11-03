// @vitest-environment jsdom
/**
 * Testes de CARACTERIZAÇÃO da tela principal (src/app/page.tsx).
 * Registram o comportamento atual antes da refatoração do Prompt 2.
 * A fronteira simulada é o HTTP (fetch para /api/...) e o Supabase Auth;
 * a tela é renderizada de verdade.
 */
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";

const navegacao = { replace: vi.fn(), refresh: vi.fn(), push: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => navegacao }));

const auth = {
  getUser: vi.fn(async () => ({ data: { user: { email: "davi@teste.com" } } })),
  signOut: vi.fn(async () => ({})),
};
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth }) }));

type Chamada = { metodo: string; url: string; corpo: unknown };
let chamadas: Chamada[];
let respostas: Record<string, { status: number; corpo?: unknown } | (() => Promise<{ status: number; corpo?: unknown }>)>;

const caneta = {
  id: "11111111-1111-1111-1111-111111111111",
  nome: "Caneta azul",
  categoria: "Papelaria",
  preco: 2.5,
  quantidade: 2,
  estoque_minimo: 3,
  estoque_baixo: true,
  created_at: "2026-11-01T10:00:00.000Z",
};
const detergente = {
  id: "22222222-2222-2222-2222-222222222222",
  nome: "Detergente",
  categoria: "Limpeza",
  preco: 4,
  quantidade: 10,
  estoque_minimo: 2,
  estoque_baixo: false,
  created_at: "2026-11-01T10:00:00.000Z",
};
const listagem = { produtos: [caneta, detergente], resumo: { total_produtos: 2, em_alerta: 1, valor_total: 45 } };

beforeEach(() => {
  chamadas = [];
  respostas = { "GET /api/produtos": { status: 200, corpo: listagem } };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const metodo = init?.method ?? "GET";
      chamadas.push({ metodo, url, corpo: init?.body ? JSON.parse(init.body as string) : undefined });
      const r = respostas[`${metodo} ${url}`];
      const resolvida = typeof r === "function" ? await r() : (r ?? { status: 404, corpo: { erro: "Não encontrado" } });
      return new Response(resolvida.status === 204 ? null : JSON.stringify(resolvida.corpo ?? {}), {
        status: resolvida.status,
      });
    })
  );
  Object.values(navegacao).forEach((f) => f.mockClear());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function abrirTela() {
  const usuario = userEvent.setup();
  render(<Home />);
  await screen.findByText("Caneta azul");
  return usuario;
}

function cartao(nome: string) {
  return screen.getByText(nome).closest("li")!;
}

describe("Tela principal — listagem e resumo", () => {
  it("mostra o e-mail, o resumo vindo do servidor e os produtos", async () => {
    await abrirTela();
    expect(screen.getByText("davi@teste.com")).toBeTruthy();
    expect(screen.getByText("Produtos cadastrados").nextSibling?.textContent).toBe("2");
    expect(screen.getByText("Em estoque baixo").nextSibling?.textContent).toBe("1");
    expect(screen.getByText("Valor em estoque").nextSibling?.textContent).toMatch(/R\$\s?45,00/);
    expect(screen.getByText("Detergente")).toBeTruthy();
  });

  it("destaca os produtos com estoque baixo e mostra o aviso com os nomes", async () => {
    await abrirTela();
    expect(within(cartao("Caneta azul")).getByText("Estoque baixo")).toBeTruthy();
    expect(within(cartao("Detergente")).queryByText("Estoque baixo")).toBeNull();
    expect(screen.getByText(/está com estoque baixo/).textContent).toContain("Caneta azul");
  });

  it("filtra por nome ou categoria sem chamar o servidor de novo", async () => {
    const u = await abrirTela();
    await u.type(screen.getByPlaceholderText("Buscar por nome ou categoria"), "limp");
    expect(screen.queryByText("Caneta azul")).toBeNull();
    expect(screen.getByText("Detergente")).toBeTruthy();
    await u.clear(screen.getByPlaceholderText("Buscar por nome ou categoria"));
    await u.type(screen.getByPlaceholderText("Buscar por nome ou categoria"), "xyz");
    expect(screen.getByText("Nenhum produto encontrado para essa busca.")).toBeTruthy();
    expect(chamadas.filter((c) => c.url === "/api/produtos")).toHaveLength(1);
  });

  it("mostra mensagem de lista vazia quando não há produtos", async () => {
    respostas["GET /api/produtos"] = { status: 200, corpo: { produtos: [], resumo: { total_produtos: 0, em_alerta: 0, valor_total: 0 } } };
    render(<Home />);
    expect(await screen.findByText("Nenhum produto cadastrado ainda.")).toBeTruthy();
  });

  it("redireciona para /login quando o servidor responde 401", async () => {
    respostas["GET /api/produtos"] = { status: 401, corpo: { erro: "Faça login para continuar." } };
    render(<Home />);
    await waitFor(() => expect(navegacao.replace).toHaveBeenCalledWith("/login"));
  });

  it("mostra erro quando a listagem falha", async () => {
    respostas["GET /api/produtos"] = { status: 500, corpo: { erro: "Erro interno." } };
    render(<Home />);
    expect((await screen.findByRole("alert")).textContent).toBe("Erro ao carregar produtos.");
  });

  it("sai da conta e volta para /login", async () => {
    const u = await abrirTela();
    await u.click(screen.getByRole("button", { name: "Sair" }));
    expect(auth.signOut).toHaveBeenCalled();
    expect(navegacao.replace).toHaveBeenCalledWith("/login");
  });
});

describe("Tela principal — cadastro e edição", () => {
  it("valida na tela e não chama o servidor quando nome está vazio e preço é negativo", async () => {
    const u = await abrirTela();
    await u.click(screen.getByRole("button", { name: "+ Novo produto" }));
    await u.type(screen.getByLabelText("Preço (R$) *"), "-5");
    await u.click(screen.getByRole("button", { name: "Salvar" }));
    expect(screen.getByText("Informe o nome do produto.")).toBeTruthy();
    expect(screen.getByText("O preço não pode ser negativo.")).toBeTruthy();
    expect(chamadas.filter((c) => c.metodo === "POST")).toHaveLength(0);
  });

  it("cadastra enviando quantidade_inicial e mostra sucesso", async () => {
    respostas["POST /api/produtos"] = { status: 201, corpo: { produto: caneta } };
    const u = await abrirTela();
    await u.click(screen.getByRole("button", { name: "+ Novo produto" }));
    await u.type(screen.getByLabelText("Nome *"), " Lápis ");
    await u.type(screen.getByLabelText("Categoria"), "Papelaria");
    await u.type(screen.getByLabelText("Preço (R$) *"), "1.5");
    await u.clear(screen.getByLabelText("Quantidade inicial"));
    await u.type(screen.getByLabelText("Quantidade inicial"), "7");
    await u.click(screen.getByRole("button", { name: "Salvar" }));
    expect((await screen.findByRole("status")).textContent).toBe("Produto cadastrado com sucesso.");
    expect(chamadas.find((c) => c.metodo === "POST")?.corpo).toEqual({
      nome: "Lápis",
      categoria: "Papelaria",
      preco: 1.5,
      estoque_minimo: 5,
      quantidade_inicial: 7,
    });
    expect(screen.queryByRole("button", { name: "Salvar" })).toBeNull();
    expect(chamadas.filter((c) => c.url === "/api/produtos" && c.metodo === "GET")).toHaveLength(2);
  });

  it("mostra os erros de campo devolvidos pelo servidor", async () => {
    respostas["POST /api/produtos"] = {
      status: 400,
      corpo: { erro: "Verifique os campos destacados.", campos: { nome: "O nome deve ter no máximo 100 caracteres.", quantidade_inicial: "A quantidade inicial deve ser um número inteiro." } },
    };
    const u = await abrirTela();
    await u.click(screen.getByRole("button", { name: "+ Novo produto" }));
    await u.type(screen.getByLabelText("Nome *"), "X");
    await u.type(screen.getByLabelText("Preço (R$) *"), "1");
    await u.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("O nome deve ter no máximo 100 caracteres.")).toBeTruthy();
    expect(screen.getByText("A quantidade inicial deve ser um número inteiro.")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toBe("Verifique os campos destacados.");
  });

  it("na edição, esconde a quantidade e envia PATCH sem quantidade", async () => {
    respostas[`PATCH /api/produtos/${caneta.id}`] = { status: 200, corpo: { produto: caneta } };
    const u = await abrirTela();
    await u.click(within(cartao("Caneta azul")).getByRole("button", { name: "Editar" }));
    expect(screen.getByRole("heading", { name: "Editar produto" })).toBeTruthy();
    expect(screen.queryByLabelText("Quantidade inicial")).toBeNull();
    expect((screen.getByLabelText("Nome *") as HTMLInputElement).value).toBe("Caneta azul");
    await u.clear(screen.getByLabelText("Preço (R$) *"));
    await u.type(screen.getByLabelText("Preço (R$) *"), "3");
    await u.click(screen.getByRole("button", { name: "Salvar" }));
    expect((await screen.findByRole("status")).textContent).toBe("Produto atualizado com sucesso.");
    expect(chamadas.find((c) => c.metodo === "PATCH")?.corpo).toEqual({
      nome: "Caneta azul",
      categoria: "Papelaria",
      preco: 3,
      estoque_minimo: 3,
    });
  });

  it("cancelar fecha o formulário sem chamar o servidor", async () => {
    const u = await abrirTela();
    await u.click(screen.getByRole("button", { name: "+ Novo produto" }));
    await u.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("heading", { name: "Novo produto" })).toBeNull();
    expect(chamadas).toHaveLength(1);
  });
});

describe("Tela principal — movimentações", () => {
  it("registra saída enviando só tipo, quantidade e observação", async () => {
    respostas[`POST /api/produtos/${detergente.id}/movimentacoes`] = { status: 201, corpo: { produto: detergente } };
    const u = await abrirTela();
    await u.click(within(cartao("Detergente")).getByRole("button", { name: "Saída" }));
    expect(screen.getByRole("heading", { name: "Registrar saída" })).toBeTruthy();
    await u.clear(screen.getByLabelText("Quantidade *"));
    await u.type(screen.getByLabelText("Quantidade *"), "3");
    await u.type(screen.getByLabelText("Observação"), "Venda balcão");
    await u.click(screen.getByRole("button", { name: "Confirmar" }));
    expect((await screen.findByRole("status")).textContent).toBe("Saída registrada.");
    expect(chamadas.find((c) => c.metodo === "POST")?.corpo).toEqual({ tipo: "saida", quantidade: 3, observacao: "Venda balcão" });
  });

  it("permite trocar entre entrada e saída dentro do modal", async () => {
    respostas[`POST /api/produtos/${caneta.id}/movimentacoes`] = { status: 201, corpo: { produto: caneta } };
    const u = await abrirTela();
    await u.click(within(cartao("Caneta azul")).getByRole("button", { name: "Saída" }));
    const modal = screen.getByRole("heading", { name: "Registrar saída" }).parentElement!;
    await u.click(within(modal).getByRole("button", { name: "Entrada" }));
    expect(screen.getByRole("heading", { name: "Registrar entrada" })).toBeTruthy();
    await u.click(screen.getByRole("button", { name: "Confirmar" }));
    expect((await screen.findByRole("status")).textContent).toBe("Entrada registrada.");
    expect(chamadas.find((c) => c.metodo === "POST")?.corpo).toEqual({ tipo: "entrada", quantidade: 1, observacao: null });
  });

  it("não chama o servidor quando a quantidade é zero", async () => {
    const u = await abrirTela();
    await u.click(within(cartao("Caneta azul")).getByRole("button", { name: "Entrada" }));
    await u.clear(screen.getByLabelText("Quantidade *"));
    await u.type(screen.getByLabelText("Quantidade *"), "0");
    await u.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(screen.getByRole("alert").textContent).toBe("Informe uma quantidade inteira maior que zero.");
    expect(chamadas.filter((c) => c.metodo === "POST")).toHaveLength(0);
  });

  it("mostra o erro do servidor quando o estoque é insuficiente e recarrega a lista", async () => {
    respostas[`POST /api/produtos/${caneta.id}/movimentacoes`] = { status: 409, corpo: { erro: "Estoque insuficiente para essa saída." } };
    const u = await abrirTela();
    await u.click(within(cartao("Caneta azul")).getByRole("button", { name: "Saída" }));
    await u.clear(screen.getByLabelText("Quantidade *"));
    await u.type(screen.getByLabelText("Quantidade *"), "50");
    await u.click(screen.getByRole("button", { name: "Confirmar" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Estoque insuficiente para essa saída.");
    await waitFor(() => expect(chamadas.filter((c) => c.url === "/api/produtos")).toHaveLength(2));
    expect(screen.getByRole("heading", { name: "Registrar saída" })).toBeTruthy();
  });

  it("desabilita o botão durante o envio (duplo clique envia uma vez só)", async () => {
    let liberar!: () => void;
    respostas[`POST /api/produtos/${caneta.id}/movimentacoes`] = () =>
      new Promise((ok) => (liberar = () => ok({ status: 201, corpo: { produto: caneta } })));
    const u = await abrirTela();
    await u.click(within(cartao("Caneta azul")).getByRole("button", { name: "Entrada" }));
    await u.dblClick(screen.getByRole("button", { name: "Confirmar" }));
    const botao = await screen.findByRole("button", { name: "Registrando..." });
    expect((botao as HTMLButtonElement).disabled).toBe(true);
    liberar();
    await screen.findByText("Entrada registrada.");
    expect(chamadas.filter((c) => c.metodo === "POST")).toHaveLength(1);
  });
});

describe("Tela principal — detalhes e exclusão", () => {
  it("abre os detalhes com o histórico vindo do servidor", async () => {
    respostas[`GET /api/produtos/${caneta.id}`] = {
      status: 200,
      corpo: {
        produto: caneta,
        historico: [
          { id: "m2", produto_id: caneta.id, tipo: "saida", quantidade: 1, observacao: "Venda", created_at: "2026-11-02T12:00:00.000Z" },
          { id: "m1", produto_id: caneta.id, tipo: "entrada", quantidade: 3, observacao: null, created_at: "2026-11-01T12:00:00.000Z" },
        ],
      },
    };
    const u = await abrirTela();
    await u.click(screen.getByRole("button", { name: "Caneta azul" }));
    expect(await screen.findByText("Histórico de movimentações")).toBeTruthy();
    expect(await screen.findByText("· Venda")).toBeTruthy();
    expect(screen.getByText("−1")).toBeTruthy();
    expect(screen.getByText("+3")).toBeTruthy();
    await u.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByText("Histórico de movimentações")).toBeNull();
  });

  it("pede confirmação e exclui com DELETE", async () => {
    respostas[`DELETE /api/produtos/${detergente.id}`] = { status: 204 };
    const u = await abrirTela();
    await u.click(within(cartao("Detergente")).getByRole("button", { name: "Excluir" }));
    expect(screen.getByRole("heading", { name: "Excluir produto?" })).toBeTruthy();
    const dialogo = screen.getByRole("heading", { name: "Excluir produto?" }).parentElement!;
    await u.click(within(dialogo).getByRole("button", { name: "Excluir" }));
    expect((await screen.findByRole("status")).textContent).toBe('"Detergente" foi excluído.');
    expect(chamadas.some((c) => c.metodo === "DELETE" && c.url === `/api/produtos/${detergente.id}`)).toBe(true);
  });

  it("mostra o erro do servidor quando a exclusão falha", async () => {
    respostas[`DELETE /api/produtos/${detergente.id}`] = { status: 404, corpo: { erro: "Produto não encontrado." } };
    const u = await abrirTela();
    await u.click(within(cartao("Detergente")).getByRole("button", { name: "Excluir" }));
    const dialogo = screen.getByRole("heading", { name: "Excluir produto?" }).parentElement!;
    await u.click(within(dialogo).getByRole("button", { name: "Excluir" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Produto não encontrado.");
  });
});
