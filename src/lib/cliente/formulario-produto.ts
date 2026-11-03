/**
 * Regras do formulário de produto na TELA (resposta rápida ao usuário).
 * A validação que vale de verdade é a do servidor (src/lib/server/validacao.ts).
 */
import type { Produto } from "@/lib/cliente/tipos";

export type FormProduto = {
  nome: string;
  categoria: string;
  preco: string;
  quantidade: string;
  estoque_minimo: string;
};

export type ErrosFormProduto = Partial<Record<keyof FormProduto, string>>;

export const formVazio: FormProduto = { nome: "", categoria: "", preco: "", quantidade: "0", estoque_minimo: "5" };

export function produtoParaForm(p: Produto): FormProduto {
  return {
    nome: p.nome,
    categoria: p.categoria ?? "",
    preco: String(p.preco),
    quantidade: String(p.quantidade),
    estoque_minimo: String(p.estoque_minimo),
  };
}

export function validarFormProduto(f: FormProduto): ErrosFormProduto {
  const erros: ErrosFormProduto = {};
  if (!f.nome.trim()) erros.nome = "Informe o nome do produto.";
  if (f.preco === "" || isNaN(Number(f.preco))) erros.preco = "Informe um preço válido.";
  else if (Number(f.preco) < 0) erros.preco = "O preço não pode ser negativo.";
  if (!Number.isInteger(Number(f.quantidade)) || Number(f.quantidade) < 0)
    erros.quantidade = "A quantidade deve ser um número inteiro maior ou igual a zero.";
  if (!Number.isInteger(Number(f.estoque_minimo)) || Number(f.estoque_minimo) < 0)
    erros.estoque_minimo = "O estoque mínimo deve ser um número inteiro maior ou igual a zero.";
  return erros;
}

/** Corpo enviado ao servidor. Na edição, a quantidade não é enviada. */
export function corpoDoForm(form: FormProduto, editando: boolean) {
  const dados = {
    nome: form.nome.trim(),
    categoria: form.categoria.trim() || null,
    preco: Number(form.preco),
    estoque_minimo: Number(form.estoque_minimo),
  };
  return editando ? dados : { ...dados, quantidade_inicial: Number(form.quantidade) };
}

/** O servidor chama o campo de "quantidade_inicial"; na tela ele é "quantidade". */
export function errosDoServidor(campos: Record<string, string>): ErrosFormProduto {
  const { quantidade_inicial, ...outros } = campos;
  return { ...outros, ...(quantidade_inicial ? { quantidade: quantidade_inicial } : {}) };
}
