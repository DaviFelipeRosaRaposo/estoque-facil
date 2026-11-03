import { formatarMoeda } from "@/lib/cliente/formatacao";
import type { Produto, Resumo } from "@/lib/cliente/tipos";

export function ResumoEstoque({ resumo }: { resumo: Resumo }) {
  return (
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
  );
}

export function AlertaEstoqueBaixo({ produtos }: { produtos: Produto[] }) {
  // "Estoque baixo" vem calculado do servidor.
  const emAlerta = produtos.filter((p) => p.estoque_baixo);
  if (emAlerta.length === 0) return null;
  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <strong>Atenção:</strong> {emAlerta.map((p) => p.nome).join(", ")}{" "}
      {emAlerta.length === 1 ? "está" : "estão"} com estoque baixo.
    </div>
  );
}
