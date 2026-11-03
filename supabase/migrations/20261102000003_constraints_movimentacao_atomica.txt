-- Prompt 1 / Correção 2 — regras no banco e movimentação atômica
--
-- Antes: a tela calculava a nova quantidade e gravava o valor final; duas
-- saídas simultâneas causavam atualização perdida, e o banco aceitava preço
-- e quantidade negativos.
--
-- Depois: o banco recusa dados inválidos (CHECK / NOT NULL) e a movimentação
-- é uma única operação atômica: atualiza a quantidade relativa
-- (quantidade = quantidade ± n) somente se houver saldo, e grava o histórico
-- na mesma transação.

-- 1. Integridade dos produtos
alter table public.produtos
  alter column user_id drop default,
  alter column user_id set not null,
  alter column preco set not null,
  alter column quantidade set not null,
  alter column estoque_minimo set not null,
  alter column created_at set not null;

alter table public.produtos
  add constraint produtos_nome_valido check (char_length(btrim(nome)) between 1 and 100),
  add constraint produtos_categoria_valida check (categoria is null or char_length(categoria) <= 50),
  add constraint produtos_preco_nao_negativo check (preco >= 0),
  add constraint produtos_quantidade_nao_negativa check (quantidade >= 0),
  add constraint produtos_estoque_minimo_nao_negativo check (estoque_minimo >= 0);

-- 2. Integridade das movimentações
alter table public.movimentacoes
  alter column produto_id set not null,
  alter column user_id drop default,
  alter column user_id set not null,
  alter column tipo set not null,
  alter column quantidade set not null,
  alter column created_at set not null;

alter table public.movimentacoes
  add constraint movimentacoes_user_fk foreign key (user_id) references auth.users(id) on delete cascade,
  add constraint movimentacoes_tipo_valido check (tipo in ('entrada', 'saida')),
  add constraint movimentacoes_quantidade_positiva check (quantidade > 0),
  add constraint movimentacoes_observacao_valida check (observacao is null or char_length(observacao) <= 200);

create index if not exists produtos_user_id_idx on public.produtos (user_id);
create index if not exists movimentacoes_produto_idx on public.movimentacoes (produto_id, created_at desc);

-- 3. Movimentação atômica
create or replace function app.registrar_movimentacao(
  p_produto_id uuid,
  p_tipo text,
  p_quantidade integer,
  p_observacao text default null
)
returns public.produtos
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := app.usuario_atual();
  v_produto public.produtos;
begin
  if v_usuario is null then
    raise exception 'nao_autenticado' using errcode = '42501';
  end if;
  if p_tipo is null or p_tipo not in ('entrada', 'saida') then
    raise exception 'tipo_invalido' using errcode = '22023';
  end if;
  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'quantidade_invalida' using errcode = '22023';
  end if;

  -- O UPDATE trava a linha. Se duas saídas chegam juntas, a segunda espera a
  -- primeira terminar e reavalia "quantidade >= p_quantidade" com o valor novo.
  update public.produtos
     set quantidade = quantidade + case when p_tipo = 'entrada' then p_quantidade else -p_quantidade end
   where id = p_produto_id
     and user_id = v_usuario
     and (p_tipo = 'entrada' or quantidade >= p_quantidade)
  returning * into v_produto;

  if not found then
    if exists (select 1 from public.produtos where id = p_produto_id and user_id = v_usuario) then
      raise exception 'estoque_insuficiente' using errcode = 'P0001';
    end if;
    raise exception 'produto_nao_encontrado' using errcode = 'P0002';
  end if;

  insert into public.movimentacoes (produto_id, user_id, tipo, quantidade, observacao)
  values (p_produto_id, v_usuario, p_tipo, p_quantidade, nullif(btrim(p_observacao), ''));

  return v_produto;
end;
$$;

revoke all on function app.registrar_movimentacao(uuid, text, integer, text) from public;
grant execute on function app.registrar_movimentacao(uuid, text, integer, text) to estoque_app;
