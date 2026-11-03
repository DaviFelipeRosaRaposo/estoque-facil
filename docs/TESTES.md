# Testes

## Como rodar

```bash
npm install
npm test
```

Esse é o comando único para rodar todos os testes depois de qualquer alteração. Não precisa de Docker nem do Supabase: o `npm test` sobe um PostgreSQL de teste embutido numa pasta temporária, aplica as migrations do projeto, roda tudo e apaga o banco no final.

Para usar outro PostgreSQL local, defina `TEST_DATABASE_URL` (o nome do banco precisa conter "test", e ele é **apagado e recriado**):

```bash
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/estoque_test npm test
```

O setup recusa qualquer endereço do Supabase, para nunca rodar em produção.

## O que é testado

| Arquivo | O que cobre | Testes |
|---|---|---|
| `tests/api/produtos.test.ts` | Cadastro, listagem, busca, resumo, detalhe, edição e exclusão, incluindo validações e limites | 23 |
| `tests/api/movimentacoes.test.ts` | Entrada, saída, saldo insuficiente, dados inválidos e **requisições simultâneas** | 15 |
| `tests/api/acesso-indevido.test.ts` | Usuário B tentando ler, editar, excluir e movimentar produto do usuário A | 5 |
| `tests/db/policies.test.ts` | Banco acessado direto, como faria a API pública do Supabase: anon, authenticated e o próprio servidor sem a função atômica | 9 |

Os testes chamam as rotas reais (`src/app/api/**/route.ts`), com banco real, validações reais e policies reais. O único mock é o Supabase Auth (quem está logado), por ser um serviço externo. As frases de comportamento estão em `docs/prompts/PROMPT-3-TESTES.md`.

## Resultado da execução

Saída completa em `docs/evidencias/saida-testes-integracao.txt`.

```
 Test Files  4 passed (4)
      Tests  52 passed (52)
```

### Prova de que os testes pegam erros

Para conferir que os testes não passam "por acaso", três proteções foram desfeitas de propósito e os testes rodaram de novo:

| Alteração proposital | Resultado |
|---|---|
| Tirar a verificação de saldo da função `app.registrar_movimentacao` | 4 testes falharam (saída maior que o saldo, estoque zerado e as duas corridas simultâneas) |
| Devolver o acesso de anon/authenticated à tabela `movimentacoes` | 2 testes de policy falharam |
| Usar o `user_id` enviado pelo cliente | Nenhuma falha, porque a validação já descarta esse campo antes. É a defesa em camadas funcionando. |

Depois, tudo foi restaurado e os 52 testes voltaram a passar.

## Testes manuais (checklist)

| Fluxo | Como testar | Esperado |
|---|---|---|
| Criar conta e entrar | Tela de login > "Criar conta" | Entra no painel (ou pede confirmação por e-mail) |
| Cadastrar | "+ Novo produto" com nome, preço 10, quantidade 3, mínimo 5 | Mensagem verde e produto com etiqueta "Estoque baixo" |
| Entrada inválida | Cadastrar com nome vazio e preço -5 | Mensagens em vermelho em cada campo, nada é salvo |
| Listar e buscar | Digitar parte do nome na busca | Lista filtrada |
| Consultar | Clicar no nome do produto | Detalhes e histórico |
| Editar | "Editar" e mudar o preço | Mensagem verde e preço atualizado |
| Entrada / saída | "Saída" de quantidade maior que o estoque | Mensagem "Estoque insuficiente para essa saída." |
| Excluir | "Excluir" > confirmar | Produto some da lista |
| Celular | Abrir pelo celular ou pelo modo responsivo do navegador | Layout em uma coluna, modais na parte de baixo da tela |

## Bugs encontrados

Nenhum teste falhou por bug real. Durante a escrita dos testes, foi notado e corrigido um erro de português na mensagem de validação ("A quantidade inicial não pode ser negativo"), que passou a ser "não pode ser menor que zero". Os bugs encontrados durante a refatoração (Prompt 2) estão em `docs/prompts/PROMPT-2-REFATORACAO.md`.
