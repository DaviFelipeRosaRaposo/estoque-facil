import { registrarMovimentacao } from "@/lib/server/estoque";
import { erro, exigirId, json, lerCorpo, rota } from "@/lib/server/http";
import { validarMovimentacao } from "@/lib/server/validacao";

type Contexto = { params: Promise<{ id: string }> };

// POST /api/produtos/:id/movimentacoes — { tipo, quantidade, observacao }
// O servidor recebe só quanto entra ou sai; a nova quantidade é calculada no banco.
export const POST = rota<Contexto>(async (usuarioId, request, { params }) => {
  const id = exigirId((await params).id);
  const validacao = validarMovimentacao(await lerCorpo(request));
  if (!validacao.ok) return erro(400, "Verifique os campos destacados.", validacao.erros);
  return json({ produto: await registrarMovimentacao(usuarioId, id, validacao.dados) }, 201);
});
