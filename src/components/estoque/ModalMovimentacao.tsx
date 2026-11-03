"use client";

import { useState } from "react";
import { chamarApi } from "@/lib/cliente/api";
import type { Produto } from "@/lib/cliente/tipos";
import { campo } from "@/components/estoque/estilos";

type Tipo = "entrada" | "saida";

type Props = {
  produto: Produto;
  tipoInicial: Tipo;
  onFechar: () => void;
  onRegistrado: (mensagem: string) => void;
  /** Chamado quando o servidor recusa por falta de saldo (409). */
  onEstoqueInsuficiente: () => void;
};

export function ModalMovimentacao({ produto, tipoInicial, onFechar, onRegistrado, onEstoqueInsuficiente }: Props) {
  const [movTipo, setMovTipo] = useState<Tipo>(tipoInicial);
  const [movQtd, setMovQtd] = useState("1");
  const [movObs, setMovObs] = useState("");
  const [movErro, setMovErro] = useState<string | null>(null);
  const [movEnviando, setMovEnviando] = useState(false);

  async function registrarMovimentacao(e: React.FormEvent) {
    e.preventDefault();
    const qtd = Number(movQtd);
    if (!Number.isInteger(qtd) || qtd <= 0) {
      setMovErro("Informe uma quantidade inteira maior que zero.");
      return;
    }
    if (movEnviando) return;

    // O servidor recebe só o tipo e quanto entra/sai; ele confere o saldo e
    // atualiza a quantidade de forma atômica.
    setMovEnviando(true);
    const r = await chamarApi(`/api/produtos/${produto.id}/movimentacoes`, {
      method: "POST",
      body: JSON.stringify({ tipo: movTipo, quantidade: qtd, observacao: movObs.trim() || null }),
    });
    setMovEnviando(false);
    if (!r.ok) {
      setMovErro(r.erro);
      if (r.status === 409) onEstoqueInsuficiente();
      return;
    }
    onRegistrado(movTipo === "entrada" ? "Entrada registrada." : "Saída registrada.");
  }

  return (
    <div className="fixed inset-0 z-10 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-6 sm:rounded-2xl">
        <h2 className="text-lg font-semibold">{movTipo === "entrada" ? "Registrar entrada" : "Registrar saída"}</h2>
        <p className="mb-4 text-sm text-slate-500">
          {produto.nome} · {produto.quantidade} em estoque
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
            <button type="button" onClick={onFechar} className="rounded-lg border border-slate-300 px-4 py-2">
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
  );
}
