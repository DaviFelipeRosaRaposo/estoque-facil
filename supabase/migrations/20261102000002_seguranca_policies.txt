-- Prompt 1 / Correção 1 — policies mínimas e fechamento da API pública
--
-- Antes: a policy "Enable read access for all users" deixava qualquer visitante
-- ler todas as movimentações, e "Enable insert for authenticated users only"
-- deixava qualquer usuário logado gravar movimentação em produto alheio.
--
-- Depois: o navegador não acessa mais as tabelas pela API do Supabase (anon e
-- authenticated perdem os privilégios). Só o servidor do app acessa, usando o
-- papel restrito "estoque_app", e mesmo ele passa pelo RLS: cada usuário só
-- enxerga e altera as próprias linhas.

-- 1. Fecha o acesso direto pela API pública (PostgREST)
revoke all on table public.produtos from anon, authenticated;
revoke all on table public.movimentacoes from anon, authenticated;

drop policy if exists "Usuários veem seus produtos" on public.produtos;
drop policy if exists "Usuários cadastram produtos" on public.produtos;
drop policy if exists "Usuários atualizam seus produtos" on public.produtos;
drop policy if exists "Usuários apagam seus produtos" on public.produtos;
drop policy if exists "Enable read access for all users" on public.movimentacoes;
drop policy if exists "Enable insert for authenticated users only" on public.movimentacoes;

-- RLS continua ligado (nenhuma proteção é desligada)
alter table public.produtos enable row level security;
alter table public.movimentacoes enable row level security;

-- 2. Papel usado pelo servidor do app (não faz login sozinho)
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'estoque_app') then
    create role estoque_app nologin;
  end if;
end
$$;
grant estoque_app to postgres;

-- 3. Quem é o usuário da requisição: o servidor define app.usuario_id
--    (vindo da sessão validada no Supabase Auth) dentro de cada transação.
create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to estoque_app;

create or replace function app.usuario_atual()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.usuario_id', true), '')::uuid
$$;

revoke all on function app.usuario_atual() from public;
grant execute on function app.usuario_atual() to estoque_app;

-- 4. Privilégios mínimos do servidor.
--    "quantidade" NÃO pode ser inserida nem alterada diretamente:
--    só muda pela função app.registrar_movimentacao (migration 3).
grant usage on schema public to estoque_app;
grant select, delete on public.produtos to estoque_app;
grant insert (user_id, nome, categoria, preco, estoque_minimo) on public.produtos to estoque_app;
grant update (nome, categoria, preco, estoque_minimo) on public.produtos to estoque_app;
grant select on public.movimentacoes to estoque_app;

-- 5. Policies: cada usuário só acessa as próprias linhas
create policy produtos_select_dono on public.produtos
  for select to estoque_app
  using (user_id = app.usuario_atual());

create policy produtos_insert_dono on public.produtos
  for insert to estoque_app
  with check (user_id = app.usuario_atual());

create policy produtos_update_dono on public.produtos
  for update to estoque_app
  using (user_id = app.usuario_atual())
  with check (user_id = app.usuario_atual());

create policy produtos_delete_dono on public.produtos
  for delete to estoque_app
  using (user_id = app.usuario_atual());

create policy movimentacoes_select_dono on public.movimentacoes
  for select to estoque_app
  using (user_id = app.usuario_atual());

-- Movimentações não têm policy de insert/update/delete para estoque_app:
-- são gravadas só pela função atômica e o histórico é imutável.
