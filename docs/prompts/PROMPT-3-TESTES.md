# Prompt 3 — Testes de integração

## 1. Fluxos críticos encontrados

| Fluxo | Rota | Por que é crítico |
|---|---|---|
| Cadastro e login | Supabase Auth (serviço externo) + `src/proxy.ts` | Define quem é o usuário |
| Cadastro de produto | `POST /api/produtos` | Grava dados e define o dono |
| Listagem, busca e resumo | `GET /api/produtos` | Não pode mostrar dado de outro usuário |
| Detalhe e histórico | `GET /api/produtos/:id` | Idem |
| Edição | `PATCH /api/produtos/:id` | Não pode alterar quantidade nem produto alheio |
| Exclusão | `DELETE /api/produtos/:id` | Apaga dados |
| Entrada e saída de estoque | `POST /api/produtos/:id/movimentacoes` | Mexe no recurso limitado (estoque) |

O sistema não tem checkout, pagamento nem webhooks; esses itens do prompt não se aplicam.

## 2. Frases de comportamento (describe / it)

**POST /api/produtos — cadastro de produto**
- quando o usuário não está logado, então responde 401 e nada é gravado
- quando os dados são válidos, então responde 201, grava o produto com o usuário da sessão como dono e devolve `estoque_baixo` calculado
- quando informa quantidade inicial, então cria uma movimentação de entrada "Estoque inicial"
- quando o nome está vazio ou o preço é negativo, então responde 400 com a mensagem de cada campo
- quando a quantidade inicial é decimal ou negativa, então responde 400
- quando o corpo não é JSON, então responde 400
- quando o cliente envia `user_id` de outro usuário, então o servidor ignora e o dono é quem está logado
- quando o preço é zero, então aceita (limite válido)

**GET /api/produtos — listagem, busca e resumo**
- quando o usuário tem produtos, então lista só os dele, com total, quantidade em alerta e valor em estoque
- quando busca por parte do nome ou da categoria, então filtra sem diferenciar maiúsculas
- quando a busca contém `%`, então trata como texto e não como curinga
- quando a quantidade é igual ao mínimo, então marca como estoque baixo (limite)

**GET /api/produtos/:id — detalhe**
- quando o produto é do usuário, então devolve os dados e o histórico do mais recente para o mais antigo
- quando o id não existe ou é malformado, então responde 404

**PATCH /api/produtos/:id — edição**
- quando os dados são válidos, então atualiza nome, categoria, preço e mínimo
- quando o corpo traz `quantidade`, então ela é ignorada e o estoque não muda
- quando o estoque mínimo é negativo, então responde 400

**DELETE /api/produtos/:id — exclusão**
- quando o produto é do usuário, então responde 204 e apaga o produto e o histórico
- quando repete a exclusão (clicou 2 vezes), então a segunda responde 404 e nada quebra

**POST /api/produtos/:id/movimentacoes — entrada e saída**
- quando registra uma entrada, então soma à quantidade e grava o histórico
- quando registra uma saída com saldo, então subtrai
- quando a saída é exatamente igual ao saldo, então o estoque fica zerado (limite)
- quando a saída é maior que o saldo, então responde 409 e nada muda
- quando o estoque está zerado e tenta saída, então responde 409
- quando a quantidade é zero, negativa ou decimal, ou o tipo é inválido, então responde 400
- quando duas saídas do último item chegam ao mesmo tempo, então só uma é aceita e o estoque termina em 0, sem ficar negativo
- quando dez saídas chegam ao mesmo tempo com saldo 5, então exatamente 5 passam e o histórico bate com a quantidade
- quando entradas e saídas simultâneas acontecem, então o saldo final é exatamente a soma de todas

**Acesso indevido (usuário A x usuário B)**
- quando B lista produtos, então não vê nenhum produto de A
- quando B tenta ler, editar, excluir ou movimentar um produto de A, então responde 404 e o produto de A não muda

**Banco exposto pela API do Supabase (policies)**
- quando um visitante (`anon`) tenta ler movimentações, então o banco nega
- quando um usuário logado (`authenticated`) tenta ler, inserir ou alterar produtos direto pela API, então o banco nega
- quando o servidor (`estoque_app`) tenta alterar a quantidade direto, sem a função de movimentação, então o banco nega
- quando o servidor tenta inserir movimentação direto na tabela, então o banco nega
- quando o banco recebe preço negativo por fora do servidor, então a constraint recusa

## 3. Ambiente de teste

| Item | Escolha |
|---|---|
| Ferramenta | Vitest (já estava nas dependências) |
| Banco | PostgreSQL de verdade, embutido via `embedded-postgres`, iniciado só durante os testes numa pasta temporária, porta 54329. Sem Docker. Alternativa: variável `TEST_DATABASE_URL` apontando para um Postgres local. |
| Proteção | O setup **recusa** qualquer URL com `supabase.co`/`supabase.com` e exige banco com "test" no nome. Produção nunca é tocada. |
| Schema | Mesmas migrations do projeto (`supabase/migrations`), precedidas de `tests/db/supabase-stub.sql`, que simula `auth.users`, `auth.uid()` e os papéis `anon`/`authenticated` do Supabase. |
| Mock | Só `obterUsuarioId()` (Supabase Auth, serviço externo). Banco, validações, regras, função atômica e policies rodam de verdade. |
| Rotas | Os testes importam os handlers reais de `src/app/api/**/route.ts` e chamam com `Request` de verdade, no estilo request spec. |
| Concorrência | `Promise.all` com várias requisições ao mesmo tempo e pool de 10 conexões. |

O teste E2E opcional (Playwright) não foi incluído, porque depende do Supabase Auth real.

## 4. Resultado

Ver a seção "Resultado da execução" em `docs/TESTES.md`.

## 5. Comando único

```bash
npm test
```
