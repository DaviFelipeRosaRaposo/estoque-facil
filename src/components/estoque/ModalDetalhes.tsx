import { formatarData, formatarMoeda } from "@/lib/cliente/formatacao";
import type { Movimentacao, Produto } from "@/lib/cliente/tipos";

type Props = { produto: Produto; historico: Movimentacao[]; onFechar: () => void };

export function ModalDetalhes({ produto, historico, onFechar }: Props) {
  return (
    <div className="fixed inset-0 z-10 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-6 sm:rounded-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{produto.nome}</h2>
            <p className="text-sm text-slate-500">{produto.categoria ?? "Sem categoria"}</p>
          </div>
          <button onClick={onFechar} className="rounded-lg border border-slate-300 px-3 py-1 text-sm">
            Fechar
          </button>
        </div>
        <dl className="mb-5 grid grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-slate-500">Preço</dt>
            <dd className="font-medium">{formatarMoeda(produto.preco)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Quantidade</dt>
            <dd className="font-medium">{produto.quantidade}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Mínimo</dt>
            <dd className="font-medium">{produto.estoque_minimo}</dd>
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
  );
}
