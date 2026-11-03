# Resumo dos resultados dos 4 prompts

Ordem seguida: Prompt 4 → Prompt 1 → Prompt 3 → Prompt 2, como recomenda a atividade.

## Prompt 4 — Auditoria completa, sem alterações

Rodou sobre a versão 1, em modo somente leitura. Gerou o `AUDITORIA.md`.

| Achado | Risco | Decisão |
|---|---|---|
| Policy `USING (true)`: qualquer visitante lia todas as movimentações | Alto | Corrigir no Prompt 1 |
| Policy `WITH CHECK (true)`: usuário gravava movimentação em produto alheio | Alto | Corrigir no Prompt 1 |
| Regra de estoque só no navegador; quantidade gravada como valor final vindo do cliente | Alto | Corrigir no Prompt 1 |
| Race condition: duas saídas simultâneas deixavam o estoque errado | Alto | Corrigir no Prompt 1 |
| Nenhum teste | Médio | Prompt 3 |
| `page.tsx` com 579 linhas misturando tela, regra e banco | Médio | Prompt 2 |
| Chaves no front | — | Só chaves públicas por design; nada a rotacionar |
| Webhooks e pagamento | — | Não se aplicam ao sistema |

## Prompt 1 — Auditoria de segurança

| Correção | Resultado |
|---|---|
| Migration de policies | API pública do Supabase fechada para as tabelas, papel restrito `estoque_app` e policies "só o dono" |
| Migration de constraints e função atômica | Banco recusa valores negativos, e a saída só acontece se houver saldo, numa única operação |
| Rotas de API no servidor | Sessão validada no servidor; `user_id` e `quantidade` vindos do cliente são ignorados |
| Mensagem de erro do cadastro | Não expõe mais detalhes internos |

Nenhuma proteção foi desligada. Risco residual baixo: a conexão SSL com o banco não verifica o certificado se `DATABASE_SSL_CA` não for configurada.

## Prompt 3 — Testes de integração

| Item | Resultado |
|---|---|
| Frases de comportamento | 35 frases describe/it, cobrindo caminho feliz, erros, repetição, limites e acesso indevido |
| Ambiente | PostgreSQL de teste embutido e separado, com as mesmas migrations; recusa URLs do Supabase |
| Mock | Só o Supabase Auth |
| Resultado | **52 de 52 passando** |
| Prova | Desfazendo de propósito a checagem de saldo e as permissões, 6 testes falharam |
| Bugs reais | Nenhum teste falhou por bug real |
| Comando | `npm test` |

## Prompt 2 — Refatoração segura

| Item | Resultado |
|---|---|
| Arquivo | `src/app/page.tsx` |
| Antes da refatoração | 20 testes de caracterização da tela |
| Passos | 6 commits pequenos, testes rodando no fim de cada um |
| Resultado | 614 → 202 linhas e 17 → 10 estados; 72 de 72 testes passando em todos os passos |
| Bugs anotados (não corrigidos) | 5 (R1 a R5 em `docs/prompts/PROMPT-2-REFATORACAO.md`) |

## O que a IA errou ou precisou de revisão

- A primeira versão gerada funcionava, mas usava os modelos de policy do próprio painel do Supabase ("Enable read access for all users"), que deixavam os dados abertos. Só a auditoria revelou isso.
- A primeira versão calculava o estoque no navegador. Funcionava em teste manual com uma aba, mas falhava com acessos simultâneos.
- Uma mensagem de validação saiu com erro de concordância ("não pode ser negativo" para "quantidade").
- No ambiente de teste, o banco embutido não iniciava porque a pasta temporária foi criada com permissão errada. Foi corrigido no setup.
