import { formatarMoeda } from "@/lib/cliente/formatacao";
import type { Produto } from "@/lib/cliente/tipos";

type Acoes = {
  onDetalhe: (p: Produto) => void;
  onMovimentar: (p: Produto, tipo: "entrada" | "saida") => void;
  onEditar: (p: Produto) => void;
  onExcluir: (p: Produto) => void;
};

type Props = Acoes & {
  carregando: boolean;
  produtos: Produto[];
  filtrados: Produto[];
};

export function ListaProdutos({ carregando, produtos, filtrados, ...acoes }: Props) {
  if (carregando) return <p className="py-10 text-center text-slate-500">Carregando...</p>;

  if (filtrados.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white py-12 text-center text-slate-500">
        {produtos.length === 0 ? "Nenhum produto cadastrado ainda." : "Nenhum produto encontrado para essa busca."}
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {filtrados.map((p) => (
        <CartaoProduto key={p.id} produto={p} {...acoes} />
      ))}
    </ul>
  );
}

function CartaoProduto({ produto: p, onDetalhe, onMovimentar, onEditar, onExcluir }: Acoes & { produto: Produto }) {
  const baixo = p.estoque_baixo;
  return (
    <li className={`rounded-xl border bg-white p-4 ${baixo ? "border-amber-300" : "border-slate-200"}`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => onDetalhe(p)} className="truncate text-left font-semibold hover:underline">
              {p.nome}
            </button>
            {p.categoria && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{p.categoria}</span>}
            {baixo && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Estoque baixo</span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {formatarMoeda(p.preco)} · <strong className="text-slate-800">{p.quantidade}</strong> em estoque · mínimo{" "}
            {p.estoque_minimo}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <button
            onClick={() => onMovimentar(p, "entrada")}
            className="rounded-lg bg-emerald-50 px-3 py-1.5 font-medium text-emerald-700 hover:bg-emerald-100"
          >
            Entrada
          </button>
          <button
            onClick={() => onMovimentar(p, "saida")}
            className="rounded-lg bg-sky-50 px-3 py-1.5 font-medium text-sky-700 hover:bg-sky-100"
          >
            Saída
          </button>
          <button onClick={() => onEditar(p)} className="rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-100">
            Editar
          </button>
          <button
            onClick={() => onExcluir(p)}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-red-700 hover:bg-red-50"
          >
            Excluir
          </button>
        </div>
      </div>
    </li>
  );
}
