/**
 * Validação feita no SERVIDOR. É a que vale: a validação da tela serve só
 * para dar resposta rápida ao usuário e pode ser contornada.
 * Campos não listados aqui (ex.: user_id, quantidade na edição) são ignorados.
 */

export type DadosProduto = {
  nome: string;
  categoria: string | null;
  preco: number;
  estoque_minimo: number;
};

export type DadosNovoProduto = DadosProduto & { quantidade_inicial: number };

export type DadosMovimentacao = {
  tipo: "entrada" | "saida";
  quantidade: number;
  observacao: string | null;
};

export type ErrosCampos = Record<string, string>;

export type Resultado<T> = { ok: true; dados: T } | { ok: false; erros: ErrosCampos };

const PRECO_MAXIMO = 99_999_999.99;
const INTEIRO_MAXIMO = 1_000_000;

function paraNumero(valor: unknown): number | null {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  if (typeof valor === "string" && valor.trim() !== "") {
    const n = Number(valor.trim().replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

function corpo(entrada: unknown): Record<string, unknown> {
  return entrada && typeof entrada === "object" && !Array.isArray(entrada) ? (entrada as Record<string, unknown>) : {};
}

function validarInteiro(valor: unknown, campo: string, rotulo: string, erros: ErrosCampos, padrao?: number) {
  if ((valor === undefined || valor === null || valor === "") && padrao !== undefined) return padrao;
  const n = paraNumero(valor);
  if (n === null || !Number.isInteger(n)) {
    erros[campo] = `${rotulo} deve ser um número inteiro.`;
    return 0;
  }
  if (n < 0) {
    erros[campo] = `${rotulo} não pode ser negativo.`;
    return 0;
  }
  if (n > INTEIRO_MAXIMO) {
    erros[campo] = `${rotulo} deve ser no máximo ${INTEIRO_MAXIMO.toLocaleString("pt-BR")}.`;
    return 0;
  }
  return n;
}

function validarBase(b: Record<string, unknown>, erros: ErrosCampos): DadosProduto {
  const nome = texto(b.nome);
  if (!nome) erros.nome = "Informe o nome do produto.";
  else if (nome.length > 100) erros.nome = "O nome deve ter no máximo 100 caracteres.";

  const categoria = texto(b.categoria);
  if (categoria.length > 50) erros.categoria = "A categoria deve ter no máximo 50 caracteres.";

  let preco = paraNumero(b.preco);
  if (preco === null) {
    erros.preco = "Informe um preço válido.";
    preco = 0;
  } else if (preco < 0) {
    erros.preco = "O preço não pode ser negativo.";
  } else if (preco > PRECO_MAXIMO) {
    erros.preco = "Preço acima do limite permitido.";
  }

  const estoque_minimo = validarInteiro(b.estoque_minimo, "estoque_minimo", "O estoque mínimo", erros, 5);

  return { nome, categoria: categoria || null, preco: Math.round(preco * 100) / 100, estoque_minimo };
}

export function validarNovoProduto(entrada: unknown): Resultado<DadosNovoProduto> {
  const b = corpo(entrada);
  const erros: ErrosCampos = {};
  const base = validarBase(b, erros);
  const quantidade_inicial = validarInteiro(b.quantidade_inicial, "quantidade_inicial", "A quantidade inicial", erros, 0);
  return Object.keys(erros).length ? { ok: false, erros } : { ok: true, dados: { ...base, quantidade_inicial } };
}

export function validarEdicaoProduto(entrada: unknown): Resultado<DadosProduto> {
  const erros: ErrosCampos = {};
  const dados = validarBase(corpo(entrada), erros);
  return Object.keys(erros).length ? { ok: false, erros } : { ok: true, dados };
}

export function validarMovimentacao(entrada: unknown): Resultado<DadosMovimentacao> {
  const b = corpo(entrada);
  const erros: ErrosCampos = {};

  const tipo = b.tipo;
  if (tipo !== "entrada" && tipo !== "saida") erros.tipo = "O tipo deve ser entrada ou saída.";

  const n = paraNumero(b.quantidade);
  let quantidade = 0;
  if (n === null || !Number.isInteger(n) || n <= 0) erros.quantidade = "Informe uma quantidade inteira maior que zero.";
  else if (n > INTEIRO_MAXIMO) erros.quantidade = `A quantidade deve ser no máximo ${INTEIRO_MAXIMO.toLocaleString("pt-BR")}.`;
  else quantidade = n;

  const observacao = texto(b.observacao);
  if (observacao.length > 200) erros.observacao = "A observação deve ter no máximo 200 caracteres.";

  return Object.keys(erros).length
    ? { ok: false, erros }
    : { ok: true, dados: { tipo: tipo as "entrada" | "saida", quantidade, observacao: observacao || null } };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function idValido(id: string) {
  return UUID.test(id);
}
