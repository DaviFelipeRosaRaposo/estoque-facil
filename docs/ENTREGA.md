# Entrega — rascunhos para adaptar

## Postagem no Google Classroom

Nome: Davi [SOBRENOME COMPLETO]
Turma: [TURMA] — Ciência da Computação, Faculdade COTEMIG

Repositório GitHub: https://github.com/DaviFelipeRosaRaposo/estoque-facil
Sistema publicado: https://SEU-PROJETO.vercel.app

O Estoque Fácil é um controle de estoque simplificado para pequenos comércios. Com ele é possível cadastrar, consultar, editar e excluir produtos, registrar entradas e saídas com histórico e ver um alerta quando um item chega ao estoque mínimo. Foi desenvolvido em Next.js com TypeScript, com banco PostgreSQL e login pelo Supabase, e publicado na Vercel. A ferramenta de IA utilizada foi o Claude (Anthropic), que ajudou no planejamento, na geração e explicação do código e na execução dos quatro prompts de auditoria. O relatório AUDITORIA.md, os testes automatizados (72 testes, comando `npm test`) e o resumo de cada prompt estão no repositório.

## Relato (rascunho — reescreva com suas palavras)

A IA acertou bastante na primeira versão: o CRUD completo, a tela responsiva, as mensagens de erro e o login funcionaram logo de início. O problema é que "funcionar" não era o mesmo que "estar correto". A auditoria (Prompt 4) mostrou que duas policies do banco, copiadas dos modelos padrão do Supabase, deixavam qualquer visitante ler o histórico de movimentações de todos os usuários. Mostrou também que o cálculo do estoque era feito no navegador, o que permitia gravar qualquer quantidade e gerava erro quando duas saídas aconteciam ao mesmo tempo.

Na correção (Prompt 1), as regras foram para o servidor e para o próprio banco: a saída agora é uma única operação atômica que só acontece se houver saldo. Os testes de integração (Prompt 3) provaram isso disparando dez saídas simultâneas com saldo cinco: exatamente cinco passam. Também confirmei que os testes servem para algo, porque, ao desfazer as proteções de propósito, eles falharam. Na refatoração (Prompt 2) aprendi a escrever testes de caracterização antes de mexer no código e a mover uma parte por vez, rodando os testes a cada passo. Com isso, o arquivo principal caiu de 614 para 202 linhas sem mudar o comportamento.

O principal aprendizado foi que código gerado por IA precisa ser auditado e testado como qualquer outro, principalmente na parte de segurança, que não aparece num teste manual. [Complete com o que você achou mais difícil ou mais interessante.]
