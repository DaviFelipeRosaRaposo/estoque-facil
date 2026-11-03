-- Estoque Fácil — schema inicial (versão 1)
-- Rodar no SQL Editor do Supabase.

create table if not exists public.produtos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) default auth.uid(),
  nome text not null,
  categoria text,
  preco numeric(10, 2),
  quantidade integer default 0,
  estoque_minimo integer default 5,
  created_at timestamptz default now()
);

create table if not exists public.movimentacoes (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid references public.produtos(id) on delete cascade,
  user_id uuid default auth.uid(),
  tipo text,
  quantidade integer,
  observacao text,
  created_at timestamptz default now()
);

alter table public.produtos enable row level security;
alter table public.movimentacoes enable row level security;

create policy "Usuários veem seus produtos"
  on public.produtos for select
  using (auth.uid() = user_id);

create policy "Usuários cadastram produtos"
  on public.produtos for insert
  with check (auth.uid() = user_id);

create policy "Usuários atualizam seus produtos"
  on public.produtos for update
  using (auth.uid() = user_id);

create policy "Usuários apagam seus produtos"
  on public.produtos for delete
  using (auth.uid() = user_id);

create policy "Enable read access for all users"
  on public.movimentacoes for select
  using (true);

create policy "Enable insert for authenticated users only"
  on public.movimentacoes for insert
  to authenticated
  with check (true);
