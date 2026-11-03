import "server-only";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Retorna o id do usuário logado ou null.
 * getUser() valida o token no servidor do Supabase Auth, então o id não pode
 * ser forjado pelo navegador.
 */
export async function obterUsuarioId(): Promise<string | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}
