"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { chamarApi } from "@/lib/cliente/api";
import { Aviso, type Mensagem } from "@/components/estoque/Aviso";
import { Cabecalho } from "@/components/estoque/Cabecalho";
import { campo } from "@/components/estoque/estilos";
import { ConfirmarExclusao } from "@/components/estoque/ConfirmarExclusao";
import { ListaProdutos } from "@/components/estoque/ListaProdutos";
import { ModalDetalhes } from "@/components/estoque/ModalDetalhes";
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
      {detalhe && <ModalDetalhes produto={detalhe} historico={historico} onFechar={() => setDetalhe(null)} />}

      {/* Confirmação de exclusão */}
      {excluindo && (
        <ConfirmarExclusao produto={excluindo} onCancelar={() => setExcluindo(null)} onConfirmar={confirmarExclusao} />
      )}
    </div>
  );
}
