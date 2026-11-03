# Publicação passo a passo (Supabase + GitHub + Vercel)

Tudo no plano gratuito. Leva uns 20 minutos.

## 1. Supabase (banco e login)

1. Crie uma conta em https://supabase.com e um **New project**. Anote a senha do banco e escolha a região **South America (São Paulo)**.
2. Abra **SQL Editor > New query**, cole o conteúdo de cada arquivo abaixo **nesta ordem** e clique em **Run** a cada um:
   1. `supabase/migrations/20261102000001_schema_inicial.sql`
   2. `supabase/migrations/20261102000002_seguranca_policies.sql`
   3. `supabase/migrations/20261102000003_constraints_movimentacao_atomica.sql`
3. Em **Project Settings > API Keys**, copie a **Publishable key** (`sb_publishable_...`). Se o painel mostrar só a "anon key", ela serve do mesmo jeito.
4. Em **Project Settings > Data API** (ou API), copie a **Project URL** (`https://xxxx.supabase.co`).
5. Clique em **Connect** (no topo) > **Transaction pooler** e copie a connection string (porta **6543**). Troque `[YOUR-PASSWORD]` pela senha do banco. Essa é a `DATABASE_URL` e é **secreta**.
6. Em **Authentication > Sign In / Providers > Email**, você pode desligar **Confirm email** para facilitar a demonstração. Se deixar ligado, configure o passo 9.

## 2. Rodar no seu computador (opcional, mas recomendado)

```bash
npm install
cp .env.example .env.local   # cole os 3 valores acima
npm run dev
npm test                     # 72 testes
```

## 3. GitHub

```bash
git remote add origin https://github.com/SEU-USUARIO/estoque-facil.git
git branch -M main
git push -u origin main
```

O repositório já tem todo o histórico de commits (versão 1 → auditoria → correções → testes → refatoração). Antes do push, confira que o `.env.local` **não** aparece em `git status`.

## 4. Vercel (hospedagem)

1. Entre em https://vercel.com com a conta do GitHub > **Add New > Project** > importe `estoque-facil`.
2. Em **Environment Variables**, adicione:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `DATABASE_URL` (secreta)
3. Clique em **Deploy**. No fim, aparece o endereço `https://estoque-facil-xxxx.vercel.app`.

## 5. Finalizar

7. Coloque o link da Vercel no topo do `README.md`, faça commit e push.
8. Teste o fluxo completo no link publicado (checklist em `docs/TESTES.md`) e tire capturas de tela para a entrega.
9. Se a confirmação de e-mail estiver ligada: no Supabase, em **Authentication > URL Configuration**, coloque o link da Vercel em **Site URL**.

## Se algo der errado

| Sintoma | Causa provável |
|---|---|
| "Erro ao carregar produtos." | `DATABASE_URL` errada ou ausente na Vercel. Confira a senha e a porta 6543 e faça Redeploy depois de mudar variáveis. |
| Erro `permission to set role "estoque_app"` | Rode de novo no SQL Editor: `grant estoque_app to postgres;` |
| Fica voltando para o login | URL ou publishable key erradas, ou e-mail ainda não confirmado. |
| `relation "produtos" does not exist` | As migrations não foram rodadas, ou rodaram fora de ordem. |

Pontos verificados só no banco de teste (que simula o Supabase), não num projeto Supabase real: o comando `grant estoque_app to postgres` e a conexão pelo pooler com `SET ROLE`. Se o passo 2 da migration 2 der erro, anote o erro e me mostre.
