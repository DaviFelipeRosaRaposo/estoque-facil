type Props = { email: string | null; onSair: () => void };

export function Cabecalho({ email, onSair }: Props) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 font-bold text-white">E</div>
          <span className="text-lg font-semibold">Estoque Fácil</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden text-slate-500 sm:inline">{email}</span>
          <button onClick={onSair} className="rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-100">
            Sair
          </button>
        </div>
      </div>
    </header>
  );
}
