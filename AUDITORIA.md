# AUDITORIA.md — Estoque Fácil (versão 1)

Auditoria gerada com o **Prompt 4 (Auditoria completa, sem alterações)** sobre o commit `c7316e0` (versão 1). Nenhum arquivo do projeto foi alterado, nenhuma migration foi executada e nada foi instalado. As verificações foram feitas por leitura do código, `grep`, `git ls-files` e `npm run build`.

Arquivos auditados: `src/app/page.tsx` (579 linhas), `src/app/login/page.tsx` (130), `src/lib/supabase/client.ts` (8), `src/app/layout.tsx` (20), `supabase/migrations/20261102000001_schema_inicial.sql` (51), `package.json`, `.gitignore`, `.env.example`.

## Os 5 achados de maior risco

| # | Achado | Risco | Arquivo e linha |
|---|---|---|---|
| 1 | Policy `SELECT ... USING (true)` em `movimentacoes`: qualquer pessoa com a chave pública, mesmo sem login, lê o histórico de movimentações de **todos** os usuários. | Alto | `supabase/migrations/20261102000001_schema_inicial.sql:44-46` |
| 2 | Policy `INSERT ... WITH CHECK (true)` em `movimentacoes`: qualquer usuário logado grava movimentações em produtos de outros usuários e com `user_id` falso. | Alto | `supabase/migrations/20261102000001_schema_inicial.sql:48-51` |
| 3 | A regra de estoque (saída não pode passar do disponível, cálculo da nova quantidade) só existe no navegador. O cliente grava a quantidade final como valor absoluto, então quem chamar a API direto define qualquer quantidade, até negativa. | Alto | `src/app/page.tsx:204-216` e `:157` |
| 4 | Race condition na movimentação: a tela lê a quantidade, decide e grava o valor calculado. Duas saídas simultâneas causam "atualização perdida" e o estoque fica errado. | Alto | `src/app/page.tsx:209-214` |
| 5 | Nenhum teste automatizado e nenhum banco de teste. Nenhuma das correções acima pode ser verificada de forma repetível. | Médio | `package.json` (sem script `test`) |

## Etapa 1 — Testes de integração

| Achado | Risco | Arquivo e linha | Correção sugerida |
|---|---|---|---|
| Vitest e embedded-postgres estão nas devDependencies, mas não há configuração, script `test` nem nenhum arquivo `*.test.*`. | Médio | `package.json` | Configurar Vitest com banco PostgreSQL de teste separado (Prompt 3). |
| Não existe banco de teste separado do de produção. | Médio | não há | Usar PostgreSQL embutido só para testes; bloquear URLs de produção. |
| Comando para rodar tudo: **não existe**. Testes rodados: nenhum (0 passam, 0 falham). | Médio | — | Criar `npm test`. |
| Fluxos críticos e cobertura: cadastro/login (sem teste), cadastro de produto (sem teste), edição (sem teste), exclusão (sem teste), entrada/saída de estoque (sem teste), isolamento entre usuários (sem teste). Não há fluxo de checkout, assinatura ou webhook no sistema. | Médio | — | Testes batendo na rota de verdade para cada fluxo. |

## Etapa 2 — Confiança no cliente

### Regras de negócio que existem só no front

| Achado | Risco | Arquivo e linha | Correção sugerida |
|---|---|---|---|
| Bloqueio de saída maior que o estoque só no cliente. | Alto | `src/app/page.tsx:204-207` | Validar no servidor e no banco (operação atômica + `CHECK (quantidade >= 0)`). |
| Nova quantidade calculada no cliente e gravada como valor absoluto (`update({ quantidade: novaQuantidade })`). | Alto | `src/app/page.tsx:209-214` | Servidor recebe só tipo e quantidade movimentada e faz `quantidade = quantidade ± n` no banco. |
| A edição do produto envia `quantidade`, o que permite alterar o estoque sem gerar movimentação (some do histórico). | Médio | `src/app/page.tsx:157`, `:162`, `:416` | Quantidade só muda por movimentação; edição aceita apenas nome, categoria, preço e mínimo. |
| Validação de nome, preço ≥ 0 e inteiros ≥ 0 só no cliente; o banco aceita preço negativo, quantidade negativa, `tipo` qualquer e movimentação com quantidade 0 ou negativa. | Médio | `src/app/page.tsx:134-147`; migration `:6-20` | Validar no servidor e criar `CHECK` e `NOT NULL` no banco. |
| `user_id` do produto enviado pelo cliente. Hoje está protegido pela policy de INSERT (`auth.uid() = user_id`), mas o servidor deveria definir o dono. | Baixo | `src/app/page.tsx:167-168` | Servidor ignora `user_id` vindo do cliente. |
| Proteção de rota só no cliente (redireciona para `/login` depois de carregar). Os dados ficam protegidos pelas policies, então é só experiência de uso. | Baixo | `src/app/page.tsx:87-95` | Verificar a sessão no servidor (proxy + rotas de API). |

### Chaves e tokens no front

| Variável / chave | Onde | Classificação | Ação |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `src/lib/supabase/client.ts:5` | Pública por design | Nenhuma. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (publishable/anon key) | `src/lib/supabase/client.ts:6` | Pública por design (a segurança depende das policies) | Nenhuma, desde que as policies estejam corretas. |
| `service_role` / secret key | não encontrada | — | Nenhuma secreta no front. |

`git ls-files` mostra só o `.env.example` (sem valores reais). O `.gitignore` ignora `.env*`. **Nenhuma chave precisa ser rotacionada.**

### Supabase — tabelas e policies

| Tabela | RLS | Observação |
|---|---|---|
| `public.produtos` | Ligado | Policies corretas para dono. |
| `public.movimentacoes` | Ligado | Policies permissivas demais (abaixo). |

| Policy | Em português | Avaliação |
|---|---|---|
| `produtos` SELECT `auth.uid() = user_id` | Cada usuário lê só os próprios produtos. | Correta. |
| `produtos` INSERT `WITH CHECK (auth.uid() = user_id)` | Só cadastra produto em nome de si mesmo. | Correta. |
| `produtos` UPDATE `USING (auth.uid() = user_id)` | Só altera os próprios produtos. Sem `WITH CHECK` explícito, o Postgres reaplica o `USING` à linha nova, então não dá para "doar" o produto a outro usuário. | Correta, mas permite alterar `quantidade` direto (ver Etapa 2). |
| `produtos` DELETE `USING (auth.uid() = user_id)` | Só apaga os próprios produtos. | Correta. |
| `movimentacoes` SELECT `USING (true)` sem `TO` | **Qualquer pessoa, inclusive visitante não logado (`anon`), lê todas as movimentações de todos os usuários.** | Alto. Trocar por `auth.uid() = user_id`. |
| `movimentacoes` INSERT `TO authenticated WITH CHECK (true)` | Qualquer usuário logado insere movimentação com qualquer `produto_id` e qualquer `user_id`. | Alto. Exigir dono e que o produto pertença a ele, ou só gravar pelo servidor. |
| `movimentacoes` UPDATE / DELETE | Nenhuma policy, então ninguém altera nem apaga pela API. | Correto (histórico imutável). |

A chave `service_role` não é usada em nenhum lugar do projeto.

## Etapa 3 — Race condition

| Achado | Risco | Arquivo e linha | Correção sugerida |
|---|---|---|---|
| Movimentação lê a quantidade do estado da tela (que pode estar desatualizado), decide e grava o resultado. Exemplo: estoque 1, duas saídas de 1 ao mesmo tempo (duas abas ou dois funcionários). As duas passam na validação e as duas gravam 0, com **2 saídas no histórico e o estoque baixando só 1**. | Alto | `src/app/page.tsx:200-224` | `UPDATE produtos SET quantidade = quantidade - n WHERE id = $1 AND quantidade >= n` (atômico) + `CHECK (quantidade >= 0)`. |
| Não há constraint, operação atômica nem lock de linha protegendo. | Alto | migration `:10` | O próprio banco resolve: update condicional + check. Não é necessário lock em memória ou Redis. |
| Atualizar a quantidade e inserir a movimentação são duas chamadas separadas. Se a segunda falhar (o erro é ignorado), o estoque muda sem histórico. | Médio | `src/app/page.tsx:211-224` | Fazer as duas na mesma transação, no servidor. |
| Proteção por lock em memória, Redis ou cache: não existe. | — | — | Não é necessário; o banco resolve sozinho. |

## Etapa 4 — Idempotência

| Achado | Risco | Arquivo e linha | Correção sugerida |
|---|---|---|---|
| Webhooks: o sistema não recebe nenhum. **Não se aplica.** | — | — | — |
| Gateway de pagamento: não existe. **Não se aplica.** | — | — | — |
| O botão "Confirmar" da movimentação não fica desabilitado durante o envio. Um duplo clique registra duas movimentações. | Médio | `src/app/page.tsx:472`, `:500` | Desabilitar o botão durante o envio e garantir que o servidor processe cada movimentação de forma atômica. |

## Etapa 5 — Separação de responsabilidades

| Arquivo | Linhas | Mistura | Observação |
|---|---|---|---|
| `src/app/page.tsx` | 579 | Tela + regra de negócio + acesso ao Supabase | 15 estados `useState`, 4 modais, validação, cálculos de alerta e valor total e chamadas diretas ao banco no mesmo componente. **Candidato número 1 para refatorar.** |
| `src/app/login/page.tsx` | 130 | Tela + chamada de autenticação | Tamanho aceitável. |

Achado extra (baixo): na criação de conta, `error.message` do Supabase é mostrado direto ao usuário (`src/app/login/page.tsx:46`). Pode expor detalhes internos ou confirmar que um e-mail já está cadastrado.

## Itens não verificados

| Item | Motivo |
|---|---|
| Comportamento real das policies em um banco Supabase | Auditoria sem executar migration; análise feita por leitura do SQL. Será comprovado pelos testes do Prompt 3. |
| Configurações do painel do Supabase (confirmação de e-mail, provedores, rate limit) | Ficam fora do código. |

## Qual prompt rodar primeiro

O material fala em "5 prompts de correção", mas o arquivo tem 4. Dos três de correção, o primeiro a rodar é o **Prompt 1 (Auditoria de segurança)**, porque os achados 1 a 4 são de risco alto e expõem ou corrompem dados agora: o histórico de todos os usuários pode ser lido por qualquer visitante e o estoque pode ficar errado. Depois vêm o Prompt 3 (para provar as correções com testes) e o Prompt 2 (para dividir o `page.tsx`).
