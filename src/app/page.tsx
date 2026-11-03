"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { chamarApi } from "@/lib/cliente/api";
import { formatarData, formatarMoeda } from "@/lib/cliente/formatacao";
import {
  corpoDoForm,
  errosDoServidor,
  formVazio,
  produtoParaForm,
  validarFormProduto,
  type ErrosFormProduto,
  type FormProduto,
} from "@/lib/cliente/formulario-produto";
import { resumoVazio, type Movimentacao, type Produto, type Resumo } from "@/lib/cliente/tipos";

export default function Home() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [email, setEmail] = useState<string | null>(null);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [resumo, setResumo] = useState<Resumo>(resumoVazio);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [mensagem, setMensagem] = useState<{ tipo: "sucesso" | "erro"; texto: string } | null>(null);

  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState<Produto | null>(null);
  const [form, setForm] = useState<FormProduto>(formVazio);
  const [errosForm, setErrosForm] = useState<ErrosFormProduto>({});
  const [salvando, setSalvando] = useState(false);

  const [movProduto, setMovProduto] = useState<Produto | null>(null);
  const [movTipo, setMovTipo] = useState<"entrada" | "saida">("entrada");
  const [movQtd, setMovQtd] = useState("1");
  const [movObs, setMovObs] = useState("");
  const [movErro, setMovErro] = useState<string | null>(null);
  const [movEnviando, setMovEnviando] = useState(false);

  const [detalhe, setDetalhe] = useState<Produto | null>(null);
  const [historico, setHistorico] = useState<Movimentacao[]>([]);

  const [excluindo, setExcluindo] = useState<Produto | null>(null);

  function avisar(tipo: "sucesso" | "erro", texto: string) {
    setMensagem({ tipo, texto });
    setTimeout(() => setMensagem(null), 4000);
  }

  const carregarProdutos = useCallback(async () => {
    const r = await chamarApi<{ produtos: Produto[]; resumo: Resumo }>("/api/produtos");
    if (r.ok) {
      setProdutos(r.dados.produtos);
      setResumo(r.dados.resumo);
    } else if (r.status === 401) {
      router.replace("/login");
    } else {
      avisar("erro", "Erro ao carregar produtos.");
    }
    setCarregando(false);
  }, [router]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace("/login");
        return;
      }
      setEmail(data.user.email ?? null);
      carregarProdutos();
    });
  }, [supabase, router, carregarProdutos]);

  async function sair() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  // ---------- resumo e filtro ----------
  const filtrados = produtos.filter((p) => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return true;
    return p.nome.toLowerCase().includes(termo) || (p.categoria ?? "").toLowerCase().includes(termo);
  });

  // "Estoque baixo" e o resumo vêm calculados do servidor.
  const emAlerta = produtos.filter((p) => p.estoque_baixo);

  // ---------- cadastro / edição ----------
  function abrirNovo() {
    setEditando(null);
    setForm(formVazio);
    setErrosForm({});
    setFormAberto(true);
  }

  function abrirEdicao(p: Produto) {
    setEditando(p);
    setForm(produtoParaForm(p));
    setErrosForm({});
    setFormAberto(true);
  }

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
      return avisar("erro", r.erro);
    }
    avisar("sucesso", editando ? "Produto atualizado com sucesso." : "Produto cadastrado com sucesso.");
    setFormAberto(false);
    carregarProdutos();
  }

  // ---------- exclusão ----------
  async function confirmarExclusao() {
    if (!excluindo) return;
    const r = await chamarApi(`/api/produtos/${excluindo.id}`, { method: "DELETE" });
    if (!r.ok) avisar("erro", r.erro);
    else avisar("sucesso", `"${excluindo.nome}" foi excluído.`);
    setExcluindo(null);
    carregarProdutos();
  }

  // ---------- movimentação ----------
  function abrirMovimentacao(p: Produto, tipo: "entrada" | "saida") {
    setMovProduto(p);
    setMovTipo(tipo);
    setMovQtd("1");
    setMovObs("");
    setMovErro(null);
  }

  async function registrarMovimentacao(e: React.FormEvent) {
    e.preventDefault();
    if (!movProduto) return;
    const qtd = Number(movQtd);
    if (!Number.isInteger(qtd) || qtd <= 0) {
      setMovErro("Informe uma quantidade inteira maior que zero.");
      return;
    }
    if (movEnviando) return;

    // O servidor recebe só o tipo e quanto entra/sai; ele confere o saldo e
    // atualiza a quantidade de forma atômica.
    setMovEnviando(true);
    const r = await chamarApi(`/api/produtos/${movProduto.id}/movimentacoes`, {
      method: "POST",
      body: JSON.stringify({ tipo: movTipo, quantidade: qtd, observacao: movObs.trim() || null }),
    });
    setMovEnviando(false);
    if (!r.ok) {
      setMovErro(r.erro);
      if (r.status === 409) carregarProdutos();
      return;
    }

    avisar("sucesso", movTipo === "entrada" ? "Entrada registrada." : "Saída registrada.");
    setMovProduto(null);
    carregarProdutos();
  }

  // ---------- detalhes ----------
  async function abrirDetalhe(p: Produto) {
    setDetalhe(p);
    setHistorico([]);
    const r = await chamarApi<{ produto: Produto; historico: Movimentacao[] }>(`/api/produtos/${p.id}`);
    if (r.ok) {
      setDetalhe(r.dados.produto);
      setHistorico(r.dados.historico);
    } else {
      avisar("erro", r.erro);
    }
  }

  // ---------- tela ----------
  const campo =
    "w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 font-bold text-white">E</div>
            <span className="text-lg font-semibold">Estoque Fácil</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-slate-500 sm:inline">{email}</span>
            <button onClick={sair} className="rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-100">
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {mensagem && (
          <div
            role={mensagem.tipo === "erro" ? "alert" : "status"}
            className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
              mensagem.tipo === "erro"
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-800"
            }`}
          >
            {mensagem.texto}
          </div>
        )}

        <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">Produtos cadastrados</p>
            <p className="mt-1 text-2xl font-semibold">{resumo.total_produtos}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">Em estoque baixo</p>
            <p className={`mt-1 text-2xl font-semibold ${resumo.em_alerta ? "text-amber-600" : ""}`}>{resumo.em_alerta}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">Valor em estoque</p>
            <p className="mt-1 text-2xl font-semibold">{formatarMoeda(resumo.valor_total)}</p>
          </div>
        </section>

        {emAlerta.length > 0 && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <strong>Atenção:</strong> {emAlerta.map((p) => p.nome).join(", ")}{" "}
            {emAlerta.length === 1 ? "está" : "estão"} com estoque baixo.
          </div>
        )}

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            type="search"
            placeholder="Buscar por nome ou categoria"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className={`${campo} sm:max-w-sm`}
          />
          <button
            onClick={abrirNovo}
            className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700"
          >
            + Novo produto
          </button>
        </div>

        {carregando ? (
          <p className="py-10 text-center text-slate-500">Carregando...</p>
        ) : filtrados.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white py-12 text-center text-slate-500">
            {produtos.length === 0 ? "Nenhum produto cadastrado ainda." : "Nenhum produto encontrado para essa busca."}
          </div>
        ) : (
          <ul className="space-y-3">
            {filtrados.map((p) => {
              const baixo = p.estoque_baixo;
              return (
                <li
                  key={p.id}
                  className={`rounded-xl border bg-white p-4 ${baixo ? "border-amber-300" : "border-slate-200"}`}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <button onClick={() => abrirDetalhe(p)} className="truncate text-left font-semibold hover:underline">
                          {p.nome}
                        </button>
                        {p.categoria && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{p.categoria}</span>
                        )}
                        {baixo && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                            Estoque baixo
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        {formatarMoeda(p.preco)} · <strong className="text-slate-800">{p.quantidade}</strong> em estoque · mínimo{" "}
                        {p.estoque_minimo}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-sm">
                      <button
                        onClick={() => abrirMovimentacao(p, "entrada")}
                        className="rounded-lg bg-emerald-50 px-3 py-1.5 font-medium text-emerald-700 hover:bg-emerald-100"
                      >
                        Entrada
                      </button>
                      <button
                        onClick={() => abrirMovimentacao(p, "saida")}
                        className="rounded-lg bg-sky-50 px-3 py-1.5 font-medium text-sky-700 hover:bg-sky-100"
                      >
                        Saída
                      </button>
                      <button onClick={() => abrirEdicao(p)} className="rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-100">
                        Editar
                      </button>
                      <button
                        onClick={() => setExcluindo(p)}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-red-700 hover:bg-red-50"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      {/* Modal de cadastro / edição */}
      {formAberto && (
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
                <input
                  className={campo}
                  value={form.categoria}
                  onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                />
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
                  {errosForm.estoque_minimo && (
                    <span className="mt-1 block text-sm text-red-600">{errosForm.estoque_minimo}</span>
                  )}
                </label>
              </div>
              {editando && (
                <p className="text-sm text-slate-500">
                  A quantidade em estoque só muda pelos botões de Entrada e Saída, para ficar registrada no histórico.
                </p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setFormAberto(false)} className="rounded-lg border border-slate-300 px-4 py-2">
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
      )}

      {/* Modal de movimentação */}
      {movProduto && (
        <div className="fixed inset-0 z-10 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-t-2xl bg-white p-6 sm:rounded-2xl">
            <h2 className="text-lg font-semibold">
              {movTipo === "entrada" ? "Registrar entrada" : "Registrar saída"}
            </h2>
            <p className="mb-4 text-sm text-slate-500">
              {movProduto.nome} · {movProduto.quantidade} em estoque
            </p>
            {movErro && (
              <div role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {movErro}
              </div>
            )}
            <form onSubmit={registrarMovimentacao} className="space-y-3" noValidate>
              <div className="grid grid-cols-2 gap-2">
                {(["entrada", "saida"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setMovTipo(t)}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                      movTipo === t ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-slate-300"
                    }`}
                  >
                    {t === "entrada" ? "Entrada" : "Saída"}
                  </button>
                ))}
              </div>
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Quantidade *</span>
                <input type="number" min="1" className={campo} value={movQtd} onChange={(e) => setMovQtd(e.target.value)} />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Observação</span>
                <input className={campo} value={movObs} onChange={(e) => setMovObs(e.target.value)} />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setMovProduto(null)} className="rounded-lg border border-slate-300 px-4 py-2">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={movEnviando}
                  className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {movEnviando ? "Registrando..." : "Confirmar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de detalhes */}
      {detalhe && (
        <div className="fixed inset-0 z-10 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-6 sm:rounded-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{detalhe.nome}</h2>
                <p className="text-sm text-slate-500">{detalhe.categoria ?? "Sem categoria"}</p>
              </div>
              <button onClick={() => setDetalhe(null)} className="rounded-lg border border-slate-300 px-3 py-1 text-sm">
                Fechar
              </button>
            </div>
            <dl className="mb-5 grid grid-cols-3 gap-3 text-sm">
              <div>
                <dt className="text-slate-500">Preço</dt>
                <dd className="font-medium">{formatarMoeda(detalhe.preco)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Quantidade</dt>
                <dd className="font-medium">{detalhe.quantidade}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Mínimo</dt>
                <dd className="font-medium">{detalhe.estoque_minimo}</dd>
              </div>
            </dl>
            <h3 className="mb-2 font-medium">Histórico de movimentações</h3>
            {historico.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma movimentação registrada.</p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {historico.map((m) => (
                  <li key={m.id} className="flex items-center justify-between py-2">
                    <span>
                      <span className={m.tipo === "entrada" ? "text-emerald-700" : "text-sky-700"}>
                        {m.tipo === "entrada" ? "+" : "−"}
                        {m.quantidade}
                      </span>{" "}
                      {m.observacao && <span className="text-slate-500">· {m.observacao}</span>}
                    </span>
                    <span className="text-slate-400">{formatarData(m.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Confirmação de exclusão */}
      {excluindo && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6">
            <h2 className="text-lg font-semibold">Excluir produto?</h2>
            <p className="mt-2 text-sm text-slate-600">
              &quot;{excluindo.nome}&quot; e todo o seu histórico de movimentações serão apagados. Essa ação não pode ser desfeita.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setExcluindo(null)} className="rounded-lg border border-slate-300 px-4 py-2">
                Cancelar
              </button>
              <button onClick={confirmarExclusao} className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700">
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
