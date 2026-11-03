import type { Produto } from "@/lib/cliente/tipos";

type Props = { produto: Produto; onCancelar: () => void; onConfirmar: () => void };

export function ConfirmarExclusao({ produto, onCancelar, onConfirmar }: Props) {
  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6">
        <h2 className="text-lg font-semibold">Excluir produto?</h2>
        <p className="mt-2 text-sm text-slate-600">
          &quot;{produto.nome}&quot; e todo o seu histórico de movimentações serão apagados. Essa ação não pode ser desfeita.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancelar} className="rounded-lg border border-slate-300 px-4 py-2">
            Cancelar
          </button>
          <button onClick={onConfirmar} className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700">
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
}
