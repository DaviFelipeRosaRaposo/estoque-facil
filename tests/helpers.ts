import pg from "pg";
import { afterAll, inject, vi } from "vitest";
import { obterUsuarioId } from "@/lib/server/auth";

import * as rotaProdutos from "@/app/api/produtos/route";
import * as rotaProduto from "@/app/api/produtos/[id]/route";
import * as rotaMovimentacoes from "@/app/api/produtos/[id]/movimentacoes/route";

// ---------- banco (acesso administrativo, só para preparar e conferir) ----------

let admin: pg.Pool | null = null;

export function bancoAdmin() {
  admin ??= new pg.Pool({ connectionString: inject("urlBancoTeste"), max: 4 });
  return admin;
}

afterAll(async () => {
  await admin?.end();
  admin = null;
});

export async function limparBanco() {
  await bancoAdmin().query("truncate auth.users, public.produtos, public.movimentacoes cascade");
}

export async function criarUsuario(email: string): Promise<string> {
  const { rows } = await bancoAdmin().query("insert into auth.users (email) values ($1) returning id", [email]);
  return rows[0].id;
}

export async function quantidadeNoBanco(produtoId: string): Promise<number> {
  const { rows } = await bancoAdmin().query("select quantidade from public.produtos where id = $1", [produtoId]);
  return rows[0]?.quantidade;
}

export async function movimentacoesNoBanco(produtoId: string) {
  const { rows } = await bancoAdmin().query(
    "select tipo, quantidade, observacao, user_id from public.movimentacoes where produto_id = $1 order by created_at",
    [produtoId]
  );
  return rows;
}

// ---------- sessão (Supabase Auth mockado) ----------

export function logarComo(usuarioId: string | null) {
  vi.mocked(obterUsuarioId).mockResolvedValue(usuarioId);
}

// ---------- chamadas às rotas reais ----------

type Resposta = { status: number; corpo: any }; // eslint-disable-line @typescript-eslint/no-explicit-any

async function executar(
  handler: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>,
  metodo: string,
  caminho: string,
  corpo?: unknown,
  id = ""
): Promise<Resposta> {
  const init: RequestInit = { method: metodo };
  if (corpo !== undefined) {
    init.body = typeof corpo === "string" ? corpo : JSON.stringify(corpo);
    init.headers = { "Content-Type": "application/json" };
  }
  const res = await handler(new Request(`http://localhost${caminho}`, init), { params: Promise.resolve({ id }) });
  const texto = await res.text();
  return { status: res.status, corpo: texto ? JSON.parse(texto) : null };
}

export const api = {
  listar: (busca = "") =>
    executar(rotaProdutos.GET as never, "GET", `/api/produtos${busca ? `?busca=${encodeURIComponent(busca)}` : ""}`),
  criar: (corpo: unknown) => executar(rotaProdutos.POST as never, "POST", "/api/produtos", corpo),
  obter: (id: string) => executar(rotaProduto.GET, "GET", `/api/produtos/${id}`, undefined, id),
  editar: (id: string, corpo: unknown) => executar(rotaProduto.PATCH, "PATCH", `/api/produtos/${id}`, corpo, id),
  excluir: (id: string) => executar(rotaProduto.DELETE, "DELETE", `/api/produtos/${id}`, undefined, id),
  movimentar: (id: string, corpo: unknown) =>
    executar(rotaMovimentacoes.POST, "POST", `/api/produtos/${id}/movimentacoes`, corpo, id),
};

export async function criarProdutoValido(extra: Record<string, unknown> = {}) {
  const r = await api.criar({ nome: "Caneta azul", categoria: "Papelaria", preco: 2.5, estoque_minimo: 3, ...extra });
  if (r.status !== 201) throw new Error(`Falha ao criar produto: ${JSON.stringify(r.corpo)}`);
  return r.corpo.produto as { id: string; quantidade: number; [k: string]: unknown };
}
