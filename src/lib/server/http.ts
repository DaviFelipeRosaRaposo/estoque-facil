import "server-only";
import { obterUsuarioId } from "@/lib/server/auth";
import { ErroApp } from "@/lib/server/estoque";
import { idValido } from "@/lib/server/validacao";

export function json(dados: unknown, status = 200) {
  return Response.json(dados, { status, headers: { "Cache-Control": "no-store" } });
}

export function erro(status: number, mensagem: string, campos?: Record<string, string>) {
  return json(campos ? { erro: mensagem, campos } : { erro: mensagem }, status);
}

export async function lerCorpo(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ErroApp(400, "Corpo da requisição inválido.");
  }
}

export function exigirId(id: string) {
  // Id malformado é tratado como inexistente.
  if (!idValido(id)) throw new ErroApp(404, "Produto não encontrado.");
  return id;
}

/** Envolve uma rota: exige login e transforma erros em respostas JSON. */
export function rota<C>(fn: (usuarioId: string, request: Request, contexto: C) => Promise<Response>) {
  return async (request: Request, contexto: C) => {
    try {
      const usuarioId = await obterUsuarioId();
      if (!usuarioId) return erro(401, "Faça login para continuar.");
      return await fn(usuarioId, request, contexto);
    } catch (e) {
      if (e instanceof ErroApp) return erro(e.status, e.message, e.campos);
      console.error(e);
      return erro(500, "Erro interno. Tente novamente em instantes.");
    }
  };
}
