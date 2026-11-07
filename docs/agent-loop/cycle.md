Pedido: fornecido pelo adaptador que iniciou o ciclo.

Você é o orquestrador. Não implemente nem revise você mesmo: delegue aos subagentes `requirements`, `dev` e `reviewer` usando a ferramenta de subagentes disponível no ambiente e passe a cada um só o que ele precisa (nº da issue/PR, resultado anterior). Leia `docs/agent-loop/config.md` para `max_rodadas_revisao`, `label_revisao_manual` e o padrão `merge_automatico` (só sugestão/fallback: o modo de merge real é escolhido por sprint e fica no milestone).

Pedido vazio = **continuar a sprint ativa** (pule o passo 1).

## Passos

0. **Início de interação** — nesta ordem:

   **A. Estado da sprint** — siga "Início de interação" em `docs/agent-loop/sprint.md`:
   - sem sprint → criar Sprint 1;
   - última sprint **fechada** → só se inicia a nova (sem perguntar se continua);
   - sprint **aberta** → perguntar se deseja iniciar uma nova; se "não", segue na atual.

   Em qualquer caminho que abra sprint nova, vale o **portão** (sprint anterior integrada à produção) e a pergunta formal de pendentes (mover para a nova sprint ou backlog), ambos definidos no `sprint.md`. Portão bloqueado = exiba a mensagem e **pare o ciclo**.

   **B. Portão de revisão manual** — só se for **continuar** uma sprint existente. Liste as issues da sprint com a label `label_revisao_manual`:
   ```
   gh issue list --milestone "<prefixo_sprint>N" --label "<label_revisao_manual>" --state open --json number,title,body
   ```
   Para cada uma, leia o corpo e verifique a seção `## ⚠️ Necessita de revisão manual`:
   - **Resolvida** = a linha `- [x] Revisado manualmente` está marcada **e** o texto da "Decisão do dono" não está vazio.
   - **Não resolvida** (checkbox desmarcado, ou marcado sem decisão): **pare o ciclo** (nada de dev, nada de novos requisitos) e avise:
     > A issue #N (<título>) necessita de revisão manual e ainda não foi marcada como revisada. Escreva na issue, em "Decisão do dono", como deve ser feito e marque "Revisado manualmente"; depois peça para continuar a sprint.
     (Se marcado mas sem decisão, diga que a decisão está vazia.)
   - **Resolvida:** remova a label (`gh issue edit N --remove-label ...`), comente "Revisão manual registrada; retomando" e trate esta issue **primeiro** no passo 3, entregando ao `dev` o texto da decisão (ela **prevalece sobre o guia de padrões** neste ponto).

   **C. Destino do pedido** (se houver pedido): na sprint ativa N ou **backlog** (só registrar, nada é desenvolvido).

   **D. Opções registradas da sprint** — leia a descrição do milestone ativo (`gh api repos/{owner}/{repo}/milestones/<n> --jq .description`) e extraia a linha `**Merge na integração:** automático|manual`. Isso vale também numa sessão nova: as escolhas do dono ficam no milestone, não na conversa. Se a linha não existir (sprint antiga), use o padrão `merge_automatico` do config e avise o dono de que a sprint não tem a opção registrada, oferecendo gravá-la.

   Resultado: `sprint = N` (ou `backlog`), `branch_integracao = <prefixo_integracao>N` e `modo_merge = automático|manual`.

1. **Requisitos** — se houver pedido, chame `requirements` com o pedido **e o destino**.
   - Se devolver perguntas em vez de issues: me pergunte e pare.
   - Mostre a lista de issues criadas.
   - Destino `backlog`: pare aqui.

2. **Preparar integração** — chame `reviewer` em modo "preparar branch de integração da sprint N" (cria `<prefixo_integracao>N` se não existir: sprint 1 a partir de `branch_producao`, N>1 a partir de `<prefixo_integracao>(N-1)`). Só prossiga com `PRONTO`.

3. **Para cada issue aberta da sprint ativa, em ordem** (respeitando dependências; ignore as de backlog):
   1. Antes de delegar, confira PRs existentes da issue e sua base. PR já mesclado na integração da sprint: peça ao reviewer para reconciliar o fechamento da issue, sem reimplementar. PR aprovado aguardando merge: mantenha-o pendente, respeitando dependências. PR aberto em desenvolvimento: entregue seu número e branch ao dev para retomada. Só inicie trabalho novo quando não houver artefato existente; candidatos ambíguos exigem decisão do dono.
      Chame `dev` com a issue, a sprint N e a `branch_integracao` (e a decisão do dono, se a issue acabou de sair de revisão manual) → recebe branch e PR.
   2. **Se a primeira linha do retorno do `dev` for `NECESSITA_REVISAO_MANUAL`:** chame `requirements` em **modo revisão manual** passando o relatório do `dev` (ele registra o aviso na issue). Depois **PARE O CICLO** (break): não siga para outras issues. Mostre o link da issue e diga: *"Escreva a decisão na issue, marque 'Revisado manualmente' e peça para continuar a sprint."*
   3. Chame `reviewer` com o PR, a issue, a sprint N, a `branch_integracao` e o `modo_merge` (a regra de merge dele segue esse valor, não o do config).
   4. Trate o veredito (primeira linha do retorno):
      - `REPROVADO` → chame `dev` em **rodada de correção** (passe o nº do PR e a lista do reviewer) e volte ao 3.3.
        Conte rodadas; ao passar de `max_rodadas_revisao`, **pare a issue**: `gh issue comment` com o impasse, marque como bloqueada e siga para a próxima (ou pare se houver dependência).
      - `APROVADO_E_MERGEADO` → issue concluída, próxima.
      - `APROVADO_AGUARDANDO_MERGE` → registre o PR na lista de pendentes para eu mergear. Se a próxima issue **depende** desta (o código dela precisa estar na `branch_integracao`), **pare o ciclo** e peça o merge; se for independente, siga para a próxima.
   5. Se o `dev` devolver qualquer outra dúvida: pare e me pergunte.

4. **Resumo final** (curto): tabela `issue | PR | rodadas | status`, e o que ficou pendente para mim (inclusive revisões manuais).

## Regras
- Nunca faça merge, delete branch ou feche issue por conta própria; isso é só do `reviewer`, só com `modo_merge = automático` (opção da sprint, registrada no milestone) e só para PR com destino `branch_integracao`. Com `manual`, o `reviewer` aprova e para.
- **Nenhum agente faz merge/push na `branch_producao`** (ex.: `main`): é produção, só eu mescle manualmente. Todos os PRs têm como destino a `branch_integracao` da sprint ativa (`integration-vN`); nunca de sprint encerrada.
- Nunca abra/encerre sprint nem mova issue sem o "ok" do dono ao plano.
- Issue com revisão manual não resolvida **bloqueia a sprint inteira**: não continue, não contorne, não "adivinhe" a decisão.
- Uma issue por vez (sem paralelismo) até eu liberar.
- Ante erro de ferramenta (`gh` sem login, Docker fora do ar), pare e diga o que falta.
