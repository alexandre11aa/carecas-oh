Ação: fornecida pelo adaptador (vazio = `status`).

Este arquivo também é o **procedimento de sprint** que o `/cycle` segue no passo 0. Você (orquestrador, thread principal) conduz tudo e faz as perguntas ao dono com o mecanismo de perguntas disponível no ambiente (ou uma pergunta direta ao dono); subagentes não perguntam.

## Modelo
- **Sprint N** = milestone GitHub `<prefixo_sprint>N` + branch `<prefixo_integracao>N`.
- **Apenas uma sprint aberta** por vez.
- Sprint 1 nasce de `branch_producao`. Sprint N>1 é **clone** de `<prefixo_integracao>(N-1)` no estado atual.
- Backlog = issue **sem milestone** com label `label_backlog`.
- **Opções da sprint** (objetivo, período, **modo de merge na integração**, itens puxados do backlog) ficam registradas na **descrição do milestone** (ver template). É a fonte de verdade: uma sessão nova lê o milestone ativo e já sabe tudo que o dono escolheu, sem perguntar de novo.
- **Modo de merge** (`automático` | `manual`): vale só para PR → `integration-vN`. `automático` = o `reviewer` aprova e mescla; `manual` = o `reviewer` aprova e PARA (`APROVADO_AGUARDANDO_MERGE`), o dono mescla. Merge na `branch_producao` é sempre manual, independente disto.
- Ninguém mescla na `branch_producao`; o dono mescla `integration-vN` → `main` manualmente quando quiser.

## Descobrir a sprint ativa
```
gh api repos/{owner}/{repo}/milestones?state=open --jq '.[] | {number,title,open_issues,closed_issues,due_on}'
```
- 0 abertas → não há sprint (primeira vez ou todas encerradas).
- 1 aberta → é a ativa (N = número no título).
- 2+ abertas → inconsistência: mostre e pergunte qual manter; não prossiga sozinho.

## Início de interação (toda vez que o `/cycle` começa)
Verifique o estado e siga **um** caminho:

1. **Nenhuma sprint existe:** proponha a Sprint 1 (`integration-v1`, a partir de `branch_producao`). Perguntas: objetivo, data prevista, **modo de merge**, pedido entra nela? Sem portão, sem pendentes.
2. **Última sprint fechada** (nenhuma aberta; N = maior número entre as fechadas): **só se inicia a nova** — não pergunte se quer continuar. Execute o **portão** (confirma que `integration-vN` está integrada; se não, mensagem de bloqueio) e depois as perguntas **objetivo/data**, **modo de merge**, **backlog** (puxar algo?) e **pedido novo**. Sem pergunta de encerramento nem de pendentes (já tratadas ao encerrar). A nova é clone de `integration-vN`.
3. **Sprint aberta N:** pergunte, formalmente: *"A Sprint N está aberta (X issues abertas / Y concluídas). Deseja iniciar uma nova sprint?"*
   - **Não:** siga na Sprint N (o `/cycle` ainda verifica revisão manual pendente antes de programar).
   - **Sim:** execute `nova` completo (portão + todas as perguntas, incluindo a pergunta formal de pendentes: mover para a nova sprint, backlog ou item a item).

## `status`
Mostre (inclusive issues com a label `label_revisao_manual` e se estão resolvidas): sprint ativa, objetivo, **modo de merge** (lido da descrição do milestone; se ausente, diga que usa o padrão `merge_automatico` do config), branch, abertas/fechadas, PRs abertos para a branch, issues bloqueadas, tamanho do backlog.

## `nova` (e quando o `/cycle` decidir abrir sprint)

### Portão: a sprint anterior foi integrada à produção?
**Antes de qualquer pergunta ou ação**, verifique se `integration-vN` já está na `branch_producao`:
```
git fetch origin
git merge-base --is-ancestor origin/<prefixo_integracao>N origin/<branch_producao>   # exit 0 = integrada
gh pr list --base <branch_producao> --head <prefixo_integracao>N --state merged --json number   # alternativa (merge não-fast-forward/squash)
```
Integrada = o primeiro comando retorna 0 **ou** o segundo lista um PR mesclado.

Se **não** integrada: **pare**. Não crie sprint, branch, milestone, issue nem mova nada, e não faça as perguntas abaixo. Responda exatamente:

> A última sprint (`integration-vN`) ainda não foi integrada à produção. Mescle `integration-vN` na `main` para finalizar a sprint e, em seguida, consulte novamente para iniciar uma nova.

Se não existir sprint anterior (primeira vez), o portão não se aplica.

### Perguntas obrigatórias (só após o portão liberar)
Use o mecanismo de perguntas disponível no ambiente (ou uma pergunta direta ao dono). Colete tudo, mostre um **plano de ações** e só execute após o "ok" do dono.

1. **Encerramento:** "A Sprint N será encerrada para dar início à Sprint N+1. Confirma?" (mostre abertas/fechadas). Se não confirmar, não abra outra.
2. **Itens pendentes** — pergunta formal, sempre feita quando houver issues abertas na sprint N: *"Existem X itens pendentes na Sprint N (liste #, título, tamanho, prioridade). Deseja movê-los para a Sprint N+1 ou encaminhá-los ao backlog?"* Opções: **mover todos para a Sprint N+1**, **encaminhar todos ao backlog**, **decidir item a item**. Não assuma padrão.
3. **PRs ainda abertos** para `integration-vN`: concluir e mesclar antes de virar a sprint, ou **redirecionar** (`gh pr edit --base integration-v(N+1)`) para a nova? PR não mesclado e não redirecionado fica órfão de rastreio.
4. **Objetivo** da nova sprint (1–2 frases) e **data prevista de término** (opcional).
5. **Modo de merge na integração:** *"Nesta sprint, os PRs aprovados devem ser mesclados automaticamente em `integration-v(N+1)` pelo reviewer, ou você prefere aprovar manualmente cada merge?"* Opções: **automático** ou **manual**. Sugira como padrão o valor de `merge_automatico` do config, mas pergunte sempre; não assuma. Lembre que o merge na `main` é sempre manual.
6. **Backlog:** deseja incluir algum item do backlog na Sprint N+1? (liste os de prioridade alta)
7. **Pedido novo** desta rodada (se veio do `/cycle`): entra na Sprint N+1? (confirmar)

### Execução (após o ok)
1. Chame `reviewer` em modo "preparar branch de integração da sprint N+1" → cria `integration-v(N+1)` a partir de `integration-vN`. Só continue com `PRONTO`.
2. Crie o milestone: `gh api repos/{owner}/{repo}/milestones -f title="<prefixo_sprint>N+1" -f description="<template abaixo, com o modo de merge escolhido>" -f due_on=<ISO8601 se houver>`.
3. Mova as issues conforme as respostas 2 e 6: `gh issue edit <#> --milestone "<prefixo_sprint>N+1"` (removendo `label_backlog`) ou `--remove-milestone --add-label <label_backlog>`.
4. Redirecione PRs conforme a resposta 3.
5. Encerre a sprint N: escreva a retrospectiva na descrição do milestone (template abaixo) e `gh api -X PATCH repos/{owner}/{repo}/milestones/<n> -f state=closed`. **Não apague** `integration-vN` (rastreabilidade).
6. Resuma o que foi feito.

## `encerrar`
Passa pelo mesmo **portão** (sprint só se encerra com `integration-vN` já integrada à produção; senão, mesma mensagem de bloqueio) e pelas perguntas 1–3; os pendentes seguem a pergunta 2, só que o destino possível é o backlog. Não cria sprint nova.

## Templates

**Descrição do milestone (sprint aberta)**
```
**Objetivo:** <1–2 frases>
**Branch:** integration-vN  (clonada de: integration-v(N-1) | main)
**Período:** <início> → <fim previsto | —>
**Merge na integração:** <automático | manual>
**Backlog puxado:** <#18, #19 | —>
**Status:** aberta
```
Linhas `**Chave:** valor` são lidas pelo `/cycle` e pelos agentes (principalmente `Merge na integração`). Não renomeie as chaves. Toda nova opção de sprint ganha uma linha aqui.

**Ao encerrar** (troque `Status` e acrescente)
```
**Status:** encerrada em <data>
**Entregue:** #12, #14, #15
**Movido para Sprint N+1:** #18
**Movido para backlog:** #19
**Integrada à produção:** <data> (PR/commit de `integration-vN` → main)
**Notas:** <impedimentos, aprendizados — curto>
```

## Regras
- **Nunca** abra nova sprint (nem encerre a atual) se `integration-vN` não estiver integrada à `branch_producao`. Só avise e pare.
- Nunca crie sprint, mova issue ou encerre milestone sem o "ok" ao plano.
- Nunca apague branches `integration-v*`.
- Nunca faça merge/push em `branch_producao`.
- Registre toda escolha do dono na descrição do milestone (`gh api -X PATCH repos/{owner}/{repo}/milestones/<n> -f description=...`); mudar o modo de merge no meio da sprint exige pedido explícito do dono e atualização dessa linha.
