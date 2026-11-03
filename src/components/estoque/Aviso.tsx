export type Mensagem = { tipo: "sucesso" | "erro"; texto: string };

export function Aviso({ mensagem }: { mensagem: Mensagem }) {
  return (
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
  );
}
