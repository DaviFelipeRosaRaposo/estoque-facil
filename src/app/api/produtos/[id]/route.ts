import { atualizarProduto, excluirProduto, obterProduto } from "@/lib/server/estoque";
import { erro, exigirId, json, lerCorpo, rota } from "@/lib/server/http";
import { validarEdicaoProduto } from "@/lib/server/validacao";

type Contexto = { params: Promise<{ id: string }> };

// GET /api/produtos/:id — detalhes e histórico
export const GET = rota<Contexto>(async (usuarioId, _request, { params }) => {
  const id = exigirId((await params).id);
  return json(await obterProduto(usuarioId, id));
});

// PATCH /api/produtos/:id — edita nome, categoria, preço e estoque mínimo.
// A quantidade só muda por movimentação; se vier no corpo, é ignorada.
export const PATCH = rota<Contexto>(async (usuarioId, request, { params }) => {
  const id = exigirId((await params).id);
  const validacao = validarEdicaoProduto(await lerCorpo(request));
  if (!validacao.ok) return erro(400, "Verifique os campos destacados.", validacao.erros);
  return json({ produto: await atualizarProduto(usuarioId, id, validacao.dados) });
});

// DELETE /api/produtos/:id — exclui o produto e o histórico
export const DELETE = rota<Contexto>(async (usuarioId, _request, { params }) => {
  const id = exigirId((await params).id);
  await excluirProduto(usuarioId, id);
  return new Response(null, { status: 204 });
});
