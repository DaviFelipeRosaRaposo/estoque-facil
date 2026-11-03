# Prompt 1 — Auditoria de segurança

Aplicado sobre a versão 1 (commit `c7316e0`), depois da auditoria completa (`AUDITORIA.md`). Primeiro foi gerado só o relatório; as correções vieram depois, uma por commit, com migration separada para as policies.

## Relatório (antes das correções)

### 1. Regras de negócio no front

| Achado | Risco | Arquivo e linha | Correção proposta |
|---|---|---|---|
| Saída maior que o estoque bloqueada só na tela | Alto | `src/app/page.tsx:204-207` | Servidor e banco conferem o saldo |
| Nova quantidade calculada no navegador e gravada como valor absoluto | Alto | `src/app/page.tsx:209-214` | Servidor recebe só tipo + quantidade movimentada; banco faz `quantidade ± n` |
| Edição envia `quantidade` e altera o estoque sem gerar histórico | Médio | `src/app/page.tsx:157`, `:162` | Quantidade só muda por movimentação |
| Validações (nome, preço ≥ 0, inteiros ≥ 0) só na tela | Médio | `src/app/page.tsx:134-147` | Validação no servidor + `CHECK` no banco |
| Regra de "estoque baixo" e valor total calculados no cliente | Baixo | `src/app/page.tsx:110-111` | Calcular no servidor (SQL) |
| `user_id` do produto vem do cliente | Baixo | `src/app/page.tsx:167-168` | Servidor define o dono a partir da sessão |
| Não existe papel de admin nem limite de plano | — | — | Não se aplica |

### 2. Segredos

| Variável | Classificação | Precisa rotacionar? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Pública por design | Não |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Pública por design (publishable/anon) | Não |
| `service_role` / secret key | Não existe no projeto | — |

Nenhum segredo foi publicado (`git ls-files` só tem `.env.example`). A correção introduz `DATABASE_URL`, que é **secreta**. Ela fica só no servidor, sem prefixo `NEXT_PUBLIC_`, no `.env.local` (ignorado pelo Git) e nas variáveis de ambiente da Vercel.

### 3. Supabase

**a) RLS:** ligado em `produtos` e `movimentacoes`. Nenhuma tabela exposta com RLS desligado.

**b) Policies em português:**

| Policy | Quem pode o quê |
|---|---|
| produtos SELECT `auth.uid() = user_id` | Cada usuário lê os próprios produtos |
| produtos INSERT `auth.uid() = user_id` | Cada usuário cadastra produtos só em seu nome |
| produtos UPDATE `auth.uid() = user_id` | Cada usuário altera os próprios produtos, **incluindo a quantidade** |
| produtos DELETE `auth.uid() = user_id` | Cada usuário apaga os próprios produtos |
| movimentacoes SELECT `true` | **Qualquer pessoa, até sem login, lê todas as movimentações** |
| movimentacoes INSERT `true` (authenticated) | **Qualquer usuário logado grava movimentação em qualquer produto** |

**c) Permissivas demais:** `USING (true)` no SELECT de movimentações e `WITH CHECK (true)` no INSERT de movimentações. Nenhuma das duas compara com `auth.uid()`.

**d) Policies mínimas propostas:** cada usuário só acessa as próprias linhas. `quantidade` é campo sensível e só muda pelo servidor, por uma função atômica. O histórico de movimentações não pode ser alterado nem apagado.

**e) service_role:** não é usada em lugar nenhum, nem no navegador nem no servidor.

## Correções aplicadas (uma por vez)

| # | Correção | Arquivos | Commit |
|---|---|---|---|
| 1 | **Migration de policies.** Revoga o acesso de `anon` e `authenticated` às tabelas (o navegador não acessa mais o banco pela API pública), remove as 6 policies antigas e cria o papel restrito `estoque_app`, usado só pelo servidor, com policies "só o dono". `quantidade` fica sem permissão de INSERT/UPDATE direto. RLS continua ligado. | `supabase/migrations/20261102000002_seguranca_policies.sql` | `fix(seguranca): policies mínimas...` |
| 2 | **Regras no banco e movimentação atômica.** `NOT NULL` e `CHECK` (preço ≥ 0, quantidade ≥ 0, tipo válido, movimentação > 0) e a função `app.registrar_movimentacao`, que faz `quantidade = quantidade ± n` somente se houver saldo e grava o histórico na mesma transação. | `supabase/migrations/20261102000003_constraints_movimentacao_atomica.sql` | `fix(seguranca): constraints...` |
| 3 | **Regras de negócio no servidor.** Novas rotas `/api/produtos`, `/api/produtos/:id` e `/api/produtos/:id/movimentacoes`. O servidor valida a sessão no Supabase Auth, valida os dados, ignora `user_id` e `quantidade` vindos do cliente e roda cada consulta como `estoque_app` com RLS. A tela passou a usar essas rotas, e o botão "Confirmar" fica desabilitado durante o envio (duplo clique). O proxy renova a sessão e protege a navegação. | `src/app/api/**`, `src/lib/server/**`, `src/lib/supabase/server.ts`, `src/proxy.ts`, `src/app/page.tsx`, `.env.example` | `fix(seguranca): regras de negócio...` |
| 4 | **Mensagem de erro do cadastro.** O cadastro de conta não mostra mais a mensagem interna do Supabase. | `src/app/login/page.tsx` | `fix: mensagem genérica...` |

## Decisões

Foi criado um papel próprio (`estoque_app`) em vez de usar `authenticated` porque o navegador tem o token do usuário e consegue chamar a API do Supabase direto. Se o servidor usasse o mesmo papel, a regra "quantidade só muda pelo servidor" poderia ser contornada.

Nenhuma proteção foi desligada: RLS continua ativo e as permissões ficaram mais restritas.

Risco residual (baixo): sem a variável `DATABASE_SSL_CA`, a conexão com o banco é criptografada, mas não verifica o certificado do servidor. Para verificar, basta baixar o certificado em Project Settings > Database > SSL e colocá-lo nessa variável.

As migrations foram verificadas num PostgreSQL de teste que simula o Supabase (ver Prompt 3). No Supabase real, elas devem ser rodadas pelo SQL Editor na ordem dos nomes dos arquivos.
