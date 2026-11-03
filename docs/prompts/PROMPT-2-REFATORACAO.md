# Prompt 2 — Refatoração segura

Arquivo escolhido: **`src/app/page.tsx`** (614 linhas), apontado na auditoria como candidato número 1. Ele mistura tela, regra e acesso a dados num só componente, com 17 `useState` e 4 modais.

## 1. Mapa do arquivo

| Trecho (linhas) | O que é | Camada |
|---|---|---|
| `Produto`, `Resumo`, `Movimentacao`, `FormProduto` (7-54) | Tipos | Compartilhado |
| `RespostaApi`, `chamarApi` (20-37) | Chamada HTTP às rotas `/api` | **c. Acesso a dados** |
| `formVazio`, `resumoVazio` (56-57) | Valores iniciais | b. Regra (formulário) |
| `formatarMoeda`, `formatarData` (59-65) | Formatação pt-BR | a. UI (apresentação) |
| `carregarProdutos` (101-112) | Busca lista e resumo, trata 401 | **c. Acesso a dados** |
| `useEffect` + `getUser`, `sair` (114-128) | Sessão do Supabase Auth | c. Serviço externo |
| `filtrados`, `emAlerta` (131-138) | Filtro da busca e lista em alerta | b. Regra (de exibição) |
| `abrirNovo`, `abrirEdicao` (141-159) | Abre o modal e preenche o formulário | a. UI |
| `validar` (161-171) | Validação do formulário | **b. Regra** |
| `salvarProduto` (173-205) | Monta o corpo, chama POST/PATCH, trata erros | b + c |
| `confirmarExclusao` (208-215) | DELETE | c |
| `abrirMovimentacao`, `registrarMovimentacao` (218-253) | Validação + POST de movimentação | b + c |
| `abrirDetalhe` (256-266) | GET de detalhe | c |
| JSX: cabeçalho, mensagem, resumo, alerta, busca, lista (272-405) | Tela | **a. UI** |
| JSX: 4 modais (407-611) | Tela | **a. UI** |

## 2. Dependências cruzadas, duplicação e estado global

As 17 variáveis de estado ficam todas no componente, e qualquer modal lê e escreve no estado dos outros (`carregarProdutos` e `avisar` são chamados de todos os fluxos). O mesmo bloco "mensagem de erro em vermelho" se repete 3 vezes, a mesma classe de input (`campo`) é usada em 9 campos e o mesmo invólucro de modal se repete 3 vezes. A validação do formulário repete, em versão simplificada, a validação do servidor (`src/lib/server/validacao.ts`); isso é intencional, porque a da tela serve só para dar resposta rápida. Não há estado global fora do componente.

## 3. Nova estrutura (seguindo o padrão `src/lib` + `src/app` que o projeto já usa)

```
src/
  app/page.tsx                         -> só orquestra: estado da lista e quais modais estão abertos
  lib/cliente/
    tipos.ts                           -> Produto, Resumo, Movimentacao
    api.ts                             -> chamarApi + funções por rota (camada de dados)
    formatacao.ts                      -> formatarMoeda, formatarData
    formulario-produto.ts              -> FormProduto, formVazio, validação e montagem do corpo (regra)
  components/estoque/
    estilos.ts                         -> classe dos campos
    Cabecalho.tsx, Aviso.tsx, ResumoEstoque.tsx, AlertaEstoqueBaixo.tsx, ListaProdutos.tsx
    ModalProduto.tsx, ModalMovimentacao.tsx, ModalDetalhes.tsx, ConfirmarExclusao.tsx
```

Nenhuma biblioteca ou framework novo no código do app. Para os testes de caracterização da tela foram adicionados só `@testing-library/react`, `@testing-library/user-event` e `jsdom`, como dependências de desenvolvimento do Vitest que o projeto já usava.

## 4. Plano em passos pequenos

| Passo | Move | Testes ao final |
|---|---|---|
| 0 | Testes de caracterização da tela (20 testes), antes de mexer | ✅ |
| 1 | Tipos, formatação e `chamarApi` para `src/lib/cliente/` | ✅ |
| 2 | Formulário de produto (estado inicial, validação e corpo) para `formulario-produto.ts` | ✅ |
| 3 | Cabeçalho, aviso, resumo, alerta e lista para componentes | ✅ |
| 4 | Modal de produto (com seu próprio estado) | ✅ |
| 5 | Modal de movimentação (com seu próprio estado) | ✅ |
| 6 | Modal de detalhes e confirmação de exclusão | ✅ |

Os nomes públicos não mudaram: a página continua sendo o `export default Home` em `/`, e as rotas de API, os nomes de campos e as colunas do banco são os mesmos.

## 5. Resultado

Ver a tabela de resultado no fim deste arquivo, preenchida depois da execução.

## Bugs encontrados durante a refatoração (anotados, NÃO corrigidos)

| # | Bug | Onde | Efeito |
|---|---|---|---|
| R1 | `avisar()` cria um `setTimeout` e nunca cancela o anterior | `avisar` | Se duas ações acontecem em menos de 4 s, a segunda mensagem some antes do tempo |
| R2 | Quando a listagem falha (erro 500), a tela mostra "Nenhum produto cadastrado ainda." junto com o erro | lista | Dá a impressão de que os produtos foram apagados |
| R3 | Depois de um 409 (estoque insuficiente), a lista é recarregada, mas o modal continua mostrando a quantidade antiga ("X em estoque") | modal de movimentação | Informação desatualizada para o usuário |
| R4 | Se `getUser()` falhar por erro de rede, a tela fica em "Carregando..." para sempre | `useEffect` inicial | Tela travada sem mensagem |
| R5 | Se o detalhe falhar, o modal fica aberto com "Nenhuma movimentação registrada." | `abrirDetalhe` | Histórico parece vazio quando na verdade deu erro |

Esses bugs ficam para uma correção separada, depois da refatoração, como manda o prompt.
