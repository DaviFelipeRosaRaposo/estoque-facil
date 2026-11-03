import "server-only";
import { Pool, type PoolClient } from "pg";

let pool: Pool | null = null;

function configSsl(url: string) {
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  if (local) return false;
  // Se o certificado do Supabase (Project Settings > Database > SSL) estiver em
  // DATABASE_SSL_CA, a conexão é verificada; senão, é criptografada sem verificar a CA.
  const ca = process.env.DATABASE_SSL_CA;
  return ca ? { ca: ca.replace(/\\n/g, "\n") } : { rejectUnauthorized: false };
}

export function obterPool(): Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL não configurada.");
    pool = new Pool({
      connectionString: url,
      max: Number(process.env.DATABASE_POOL_MAX ?? 3),
      ssl: configSsl(url),
    });
  }
  return pool;
}

export async function encerrarPool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * Executa `fn` numa transação como o papel restrito `estoque_app`, com
 * app.usuario_id = usuário logado. Assim, toda consulta passa pelo RLS e só
 * enxerga as linhas desse usuário.
 */
export async function comUsuario<T>(usuarioId: string, fn: (db: PoolClient) => Promise<T>): Promise<T> {
  const client = await obterPool().connect();
  try {
    await client.query("begin");
    await client.query("set local role estoque_app");
    await client.query("select set_config('app.usuario_id', $1, true)", [usuarioId]);
    const resultado = await fn(client);
    await client.query("commit");
    return resultado;
  } catch (erro) {
    await client.query("rollback").catch(() => {});
    throw erro;
  } finally {
    client.release();
  }
}
