import "server-only";
import type { PoolClient } from "pg";
import { comUsuario } from "@/lib/server/db";
import type { DadosMovimentacao, DadosNovoProduto, DadosProduto } from "@/lib/server/validacao";

export type Produto = {
  id: string;
  nome: string;
  categoria: string | null;
  preco: number;
  quantidade: number;
  estoque_minimo: number;
  estoque_baixo: boolean;
  created_at: string;
};

export type Movimentacao = {
  id: string;
  produto_id: string;
  tipo: "entrada" | "saida";
  quantidade: number;
  observacao: string | null;
  created_at: string;
};

export type Resumo = { total_produtos: number; em_alerta: number; valor_total: number };

export class ErroApp extends Error {
  constructor(
    public status: number,
    message: string,
    public campos?: Record<string, string>
  ) {
    super(message);
  }
}

// A regra "estoque baixo" é calculada no banco, no servidor.
const COLUNAS = `id, nome, categoria, preco::float8 as preco, quantidade, estoque_minimo,
  (quantidade <= estoque_minimo) as estoque_baixo, created_at`;

function paraProduto(linha: Record<string, unknown>): Produto {
  return {
    ...(linha as Omit<Produto, "created_at">),
    created_at: new Date(linha.created_at as string).toISOString(),
  };
}

function paraMovimentacao(linha: Record<string, unknown>): Movimentacao {
  return { ...(linha as Omit<Movimentacao, "created_at">), created_at: new Date(linha.created_at as string).toISOString() };
}

/** Traduz erros do banco em respostas compreensíveis. */
function traduzirErro(erro: unknown): never {
  const e = erro as { code?: string; message?: string };
  if (e?.message === "estoque_insuficiente") throw new ErroApp(409, "Estoque insuficiente para essa saída.");
  if (e?.message === "produto_nao_encontrado") throw new ErroApp(404, "Produto não encontrado.");
  if (e?.code === "23514" || e?.code === "22023") throw new ErroApp(400, "Dados inválidos.");
  throw erro;
}

async function registrar(db: PoolClient, produtoId: string, mov: DadosMovimentacao) {
  const { rows } = await db.query(
    "select id from app.registrar_movimentacao($1, $2, $3, $4)",
    [produtoId, mov.tipo, mov.quantidade, mov.observacao]
  );
  return rows[0];
}

async function buscarProduto(db: PoolClient, id: string) {
  const { rows } = await db.query(`select ${COLUNAS} from public.produtos where id = $1`, [id]);
  return rows[0] ? paraProduto(rows[0]) : null;
}

export async function listarProdutos(usuarioId: string, busca = ""): Promise<{ produtos: Produto[]; resumo: Resumo }> {
  return comUsuario(usuarioId, async (db) => {
    const termo = busca.trim();
    const { rows } = await db.query(
      `select ${COLUNAS} from public.produtos
        where ($1 = '' or nome ilike '%' || $1 || '%' or categoria ilike '%' || $1 || '%')
        order by lower(nome), created_at`,
      [termo.replace(/[%_\\]/g, (c) => "\\" + c)]
    );
    const resumo = await db.query(
      `select count(*)::int as total_produtos,
              count(*) filter (where quantidade <= estoque_minimo)::int as em_alerta,
              coalesce(sum(preco * quantidade), 0)::float8 as valor_total
         from public.produtos`
    );
    return { produtos: rows.map(paraProduto), resumo: resumo.rows[0] };
  });
}

export async function obterProduto(usuarioId: string, id: string) {
  return comUsuario(usuarioId, async (db) => {
    const produto = await buscarProduto(db, id);
    if (!produto) throw new ErroApp(404, "Produto não encontrado.");
    const { rows } = await db.query(
      `select id, produto_id, tipo, quantidade, observacao, created_at
         from public.movimentacoes where produto_id = $1 order by created_at desc, id limit 100`,
      [id]
    );
    return { produto, historico: rows.map(paraMovimentacao) };
  });
}

export async function criarProduto(usuarioId: string, dados: DadosNovoProduto): Promise<Produto> {
  return comUsuario(usuarioId, async (db) => {
    try {
      // O dono é sempre o usuário da sessão; o servidor ignora user_id vindo do cliente.
      const { rows } = await db.query(
        `insert into public.produtos (user_id, nome, categoria, preco, estoque_minimo)
         values ($1, $2, $3, $4, $5) returning id`,
        [usuarioId, dados.nome, dados.categoria, dados.preco, dados.estoque_minimo]
      );
      const id = rows[0].id as string;
      if (dados.quantidade_inicial > 0) {
        await registrar(db, id, { tipo: "entrada", quantidade: dados.quantidade_inicial, observacao: "Estoque inicial" });
      }
      return (await buscarProduto(db, id))!;
    } catch (erro) {
      traduzirErro(erro);
    }
  });
}

export async function atualizarProduto(usuarioId: string, id: string, dados: DadosProduto): Promise<Produto> {
  return comUsuario(usuarioId, async (db) => {
    try {
      const { rowCount } = await db.query(
        `update public.produtos set nome = $2, categoria = $3, preco = $4, estoque_minimo = $5 where id = $1`,
        [id, dados.nome, dados.categoria, dados.preco, dados.estoque_minimo]
      );
      if (!rowCount) throw new ErroApp(404, "Produto não encontrado.");
      return (await buscarProduto(db, id))!;
    } catch (erro) {
      if (erro instanceof ErroApp) throw erro;
      traduzirErro(erro);
    }
  });
}

export async function excluirProduto(usuarioId: string, id: string): Promise<void> {
  await comUsuario(usuarioId, async (db) => {
    const { rowCount } = await db.query("delete from public.produtos where id = $1", [id]);
    if (!rowCount) throw new ErroApp(404, "Produto não encontrado.");
  });
}

export async function registrarMovimentacao(usuarioId: string, produtoId: string, mov: DadosMovimentacao): Promise<Produto> {
  return comUsuario(usuarioId, async (db) => {
    try {
      await registrar(db, produtoId, mov);
      return (await buscarProduto(db, produtoId))!;
    } catch (erro) {
      traduzirErro(erro);
    }
  });
}
