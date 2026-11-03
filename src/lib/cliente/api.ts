/** Camada de acesso a dados da tela: única parte que conversa com /api. */

export type RespostaApi<T> =
  | { ok: true; dados: T }
  | { ok: false; status: number; erro: string; campos?: Record<string, string> };

export async function chamarApi<T>(url: string, init?: RequestInit): Promise<RespostaApi<T>> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    });
    if (res.status === 204) return { ok: true, dados: undefined as T };
    const corpo = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, dados: corpo as T };
    return { ok: false, status: res.status, erro: corpo.erro ?? "Erro inesperado.", campos: corpo.campos };
  } catch {
    return { ok: false, status: 0, erro: "Sem conexão com o servidor." };
  }
}
