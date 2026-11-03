"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { chamarApi } from "@/lib/cliente/api";
import { formatarData, formatarMoeda } from "@/lib/cliente/formatacao";
import { Aviso, type Mensagem } from "@/components/estoque/Aviso";
import { Cabecalho } from "@/components/estoque/Cabecalho";
import { campo } from "@/components/estoque/estilos";
import { ListaProdutos } from "@/components/estoque/ListaProdutos";
import { ModalMovimentacao } from "@/components/estoque/ModalMovimentacao";
import { ModalProduto } from "@/components/estoque/ModalProduto";
import { AlertaEstoqueBaixo, ResumoEstoque } from "@/components/estoque/ResumoEstoque";
import { resumoVazio, type Movimentacao, type Produto, type Resumo } from "@/lib/cliente/tipos";

export default function Home() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [email, setEmail] = useState<string | null>(null);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [resumo, setResumo] = useState<Resumo>(resumoVazio);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [mensagem, setMensagem] = useState<Mensagem | null>(null);

  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState<Produto | null>(null);

  const [movProduto, setMovProduto] = useState<Produto | null>(null);
  const [movTipo, setMovTipo] = useState<"entrada" | "saida">("entrada");

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


  // ---------- cadastro / edição ----------
  function abrirNovo() {
    setEditando(null);
    setFormAberto(true);
  }

  function abrirEdicao(p: Produto) {
    setEditando(p);
    setFormAberto(true);
  }

  function produtoSalvo(texto: string) {
    avisar("sucesso", texto);
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
  }

  function movimentacaoRegistrada(texto: string) {
    avisar("sucesso", texto);
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
  return (
    <div className="min-h-screen">
      <Cabecalho email={email} onSair={sair} />

      <main className="mx-auto max-w-6xl px-4 py-6">
        {mensagem && <Aviso mensagem={mensagem} />}

        <ResumoEstoque resumo={resumo} />

        <AlertaEstoqueBaixo produtos={produtos} />

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

        <ListaProdutos
          carregando={carregando}
          produtos={produtos}
          filtrados={filtrados}
          onDetalhe={abrirDetalhe}
          onMovimentar={abrirMovimentacao}
          onEditar={abrirEdicao}
          onExcluir={setExcluindo}
        />
      </main>

      {/* Modal de cadastro / edição */}
      {formAberto && (
        <ModalProduto
          editando={editando}
          onFechar={() => setFormAberto(false)}
          onSalvo={produtoSalvo}
          onErro={(texto) => avisar("erro", texto)}
        />
      )}

      {/* Modal de movimentação */}
      {movProduto && (
        <ModalMovimentacao
          produto={movProduto}
          tipoInicial={movTipo}
          onFechar={() => setMovProduto(null)}
          onRegistrado={movimentacaoRegistrada}
          onEstoqueInsuficiente={carregarProdutos}
        />
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
