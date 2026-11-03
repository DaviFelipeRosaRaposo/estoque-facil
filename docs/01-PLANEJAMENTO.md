# Etapa 1 — Planejamento

## Tema escolhido

**B. Controle de estoque simplificado** — sistema "Estoque Fácil".

## Problema que o sistema resolve

Pequenos comércios, lojas de bairro e quem vende produtos pela internet costumam controlar o estoque em caderno ou planilha solta. Com isso, a quantidade real se perde, ninguém sabe quando cada entrada ou saída aconteceu e o produto acaba sem que ninguém perceba a tempo de repor. O Estoque Fácil reúne em um só lugar o cadastro dos produtos, o registro de cada entrada e saída e um alerta visível quando um item chega ao estoque mínimo. Cada usuário tem o seu próprio estoque, separado dos demais.

## Requisitos funcionais

| Código | Requisito |
|---|---|
| RF01 | O usuário cria uma conta e entra com e-mail e senha. |
| RF02 | O usuário cadastra produtos com nome, categoria, preço, quantidade inicial e estoque mínimo. |
| RF03 | O usuário lista seus produtos e pesquisa por nome ou categoria. |
| RF04 | O usuário consulta os detalhes e o histórico de movimentações de um produto. |
| RF05 | O usuário edita nome, categoria, preço e estoque mínimo de um produto. |
| RF06 | O usuário exclui um produto, com confirmação. |
| RF07 | O usuário registra entrada e saída de unidades; a quantidade é atualizada automaticamente. |
| RF08 | O sistema impede saída maior que a quantidade disponível. |
| RF09 | O sistema destaca produtos com quantidade igual ou abaixo do estoque mínimo. |
| RF10 | O sistema mostra mensagens claras de sucesso e de erro. |

## Requisitos não funcionais

| Código | Requisito |
|---|---|
| RNF01 | Interface responsiva (computador e celular). |
| RNF02 | Dados persistidos em banco PostgreSQL (Supabase). |
| RNF03 | Um usuário nunca acessa dados de outro usuário. |
| RNF04 | Nenhum segredo (senha de banco, chave secreta) no código ou no repositório. |
| RNF05 | Publicação gratuita (Vercel + Supabase plano free). |

## Regras de validação

Nome obrigatório (até 100 caracteres). Preço obrigatório, maior ou igual a zero. Quantidade inicial e estoque mínimo inteiros, maiores ou iguais a zero. Movimentação com quantidade inteira maior que zero. Saída não pode deixar o estoque negativo.

## Telas

1. **Login / Cadastro** — formulário de e-mail e senha com alternância entre "Entrar" e "Criar conta".
2. **Painel de estoque** — resumo (total de produtos, itens em alerta, valor em estoque), busca, lista de produtos com destaque de estoque baixo e botões de ação.
3. **Formulário de produto** — usado para cadastrar e editar.
4. **Movimentação** — entrada ou saída com quantidade e observação.
5. **Detalhes do produto** — dados e histórico de movimentações.

## Modelo de dados

**produtos**: id, user_id, nome, categoria, preco, quantidade, estoque_minimo, created_at.

**movimentacoes**: id, produto_id, user_id, tipo (entrada/saida), quantidade, observacao, created_at.

## Stack escolhida

| Camada | Tecnologia | Motivo |
|---|---|---|
| Front-end e back-end | Next.js (App Router) + TypeScript | Um projeto só para telas e rotas de API; deploy direto na Vercel. |
| Estilo | Tailwind CSS | Responsividade rápida sem escrever CSS do zero. |
| Banco e autenticação | Supabase (PostgreSQL + Auth) | Plano gratuito, banco relacional de verdade e login pronto. |
| Hospedagem | Vercel (plano Hobby) | Gratuito e integrado ao GitHub. |
| Testes | Vitest + PostgreSQL embutido (embedded-postgres) | Banco de teste real e separado, sem precisar de Docker. |

## Ferramenta de IA

Claude (Anthropic), usado para planejar, gerar código, explicar arquivos e executar os quatro prompts de auditoria.

## Revisão da proposta

Ficaram de fora, de propósito, funcionalidades que eu não conseguiria demonstrar ou que não são pedidas: múltiplos usuários por loja, upload de foto do produto, relatórios em PDF e leitura de código de barras.
