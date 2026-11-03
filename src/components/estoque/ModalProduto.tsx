"use client";

import { useState } from "react";
import { chamarApi } from "@/lib/cliente/api";
import {
  corpoDoForm,
  errosDoServidor,
  formVazio,
  produtoParaForm,
  validarFormProduto,
  type ErrosFormProduto,
  type FormProduto,
} from "@/lib/cliente/formulario-produto";
import type { Produto } from "@/lib/cliente/tipos";
import { campo } from "@/components/estoque/estilos";

type Props = {
  /** Produto em edição, ou null para cadastrar um novo. */
  editando: Produto | null;
  onFechar: () => void;
  onSalvo: (mensagem: string) => void;
  onErro: (mensagem: string) => void;
};

export function ModalProduto({ editando, onFechar, onSalvo, onErro }: Props) {
  const [form, setForm] = useState<FormProduto>(editando ? produtoParaForm(editando) : formVazio);
  const [errosForm, setErrosForm] = useState<ErrosFormProduto>({});
  const [salvando, setSalvando] = useState(false);

  async function salvarProduto(e: React.FormEvent) {
    e.preventDefault();
    const erros = validarFormProduto(form);
    setErrosForm(erros);
    if (Object.keys(erros).length > 0) return;

    setSalvando(true);
    const corpo = JSON.stringify(corpoDoForm(form, Boolean(editando)));
    const r = editando
      ? await chamarApi(`/api/produtos/${editando.id}`, { method: "PATCH", body: corpo })
      : await chamarApi("/api/produtos", { method: "POST", body: corpo });
    setSalvando(false);

    if (!r.ok) {
      if (r.campos) setErrosForm(errosDoServidor(r.campos));
      return onErro(r.erro);
    }
    onSalvo(editando ? "Produto atualizado com sucesso." : "Produto cadastrado com sucesso.");
  }

  return (
    <div className="fixed inset-0 z-10 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-lg rounded-t-2xl bg-white p-6 sm:rounded-2xl">
        <h2 className="mb-4 text-lg font-semibold">{editando ? "Editar produto" : "Novo produto"}</h2>
        <form onSubmit={salvarProduto} className="space-y-3" noValidate>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Nome *</span>
            <input className={campo} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            {errosForm.nome && <span className="mt-1 block text-sm text-red-600">{errosForm.nome}</span>}
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Categoria</span>
            <input className={campo} value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
          </label>
          <div className={`grid grid-cols-1 gap-3 ${editando ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Preço (R$) *</span>
              <input
                type="number"
                step="0.01"
                min="0"
                className={campo}
                value={form.preco}
                onChange={(e) => setForm({ ...form, preco: e.target.value })}
              />
              {errosForm.preco && <span className="mt-1 block text-sm text-red-600">{errosForm.preco}</span>}
            </label>
            {!editando && (
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Quantidade inicial</span>
                <input
                  type="number"
                  min="0"
                  className={campo}
                  value={form.quantidade}
                  onChange={(e) => setForm({ ...form, quantidade: e.target.value })}
                />
                {errosForm.quantidade && <span className="mt-1 block text-sm text-red-600">{errosForm.quantidade}</span>}
              </label>
            )}
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Estoque mínimo</span>
              <input
                type="number"
                min="0"
                className={campo}
                value={form.estoque_minimo}
                onChange={(e) => setForm({ ...form, estoque_minimo: e.target.value })}
              />
              {errosForm.estoque_minimo && <span className="mt-1 block text-sm text-red-600">{errosForm.estoque_minimo}</span>}
            </label>
          </div>
          {editando && (
            <p className="text-sm text-slate-500">
              A quantidade em estoque só muda pelos botões de Entrada e Saída, para ficar registrada no histórico.
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onFechar} className="rounded-lg border border-slate-300 px-4 py-2">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {salvando ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
