import { criarProduto, listarProdutos } from "@/lib/server/estoque";
import { erro, json, lerCorpo, rota } from "@/lib/server/http";
import { validarNovoProduto } from "@/lib/server/validacao";

// GET /api/produtos?busca=texto — lista os produtos do usuário e o resumo
export const GET = rota(async (usuarioId, request) => {
  const busca = new URL(request.url).searchParams.get("busca") ?? "";
  return json(await listarProdutos(usuarioId, busca.slice(0, 100)));
});

// POST /api/produtos — cadastra um produto
export const POST = rota(async (usuarioId, request) => {
  const validacao = validarNovoProduto(await lerCorpo(request));
  if (!validacao.ok) return erro(400, "Verifique os campos destacados.", validacao.erros);
  return json({ produto: await criarProduto(usuarioId, validacao.dados) }, 201);
});
