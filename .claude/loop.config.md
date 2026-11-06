# Config do loop de agentes (ÚNICO arquivo a editar ao portar para outro projeto)

Lido por `requirements`, `dev`, `reviewer` e `/cycle`. Mantenha os nomes das chaves.

## Projeto
- nome: carecas-oh
- branch_producao: main          # produção; NENHUM agente faz merge/push aqui (só o dono, manualmente)
- prefixo_integracao: integration-v   # sprint N → branch `integration-vN` (é a `branch_integracao` da sprint ativa)
- guia_de_padroes: AGENTS.md   # arquivo com arquitetura/regras que dev e reviewer devem seguir

## Git / GitHub
- prefixo_branch: feat/        # resultado: feat/<nº-issue>-<slug>
- prefixo_sprint: "Sprint "    # milestone do GitHub: "Sprint 1", "Sprint 2"...
- label_backlog: backlog       # issue sem sprint (sem milestone)
- label_bloqueada: blocked
- label_revisao_manual: needs-manual-review   # dev encontrou algo fora do padrão; aguarda decisão do dono na issue
- label_pendente: todo
- label_em_andamento: doing
- merge_estrategia: squash     # squash | merge | rebase
- merge_automatico: true       # PADRÃO/fallback do modo de merge em PR → integration-vN. O valor real é escolhido pelo dono a cada nova sprint e fica no milestone ("Merge na integração"). Merge na branch_producao é sempre manual, do dono
- max_rodadas_revisao: 3

## Convenção de commits
Formato: `:emoji: tipo: Descrição no imperativo/curta em português (#N)`
(`:tada:` é a exceção: sem tipo). O `#N` é o número da issue. Uma intenção por commit; escolha o emoji/tipo que melhor descreve a mudança.

| Emoji | Mensagem | Quando usar |
|---|---|---|
| `:tada:` | `:tada: Commit inicial` | primeiro commit do repo |
| `:sparkles:` | `:sparkles: feat: Página de login` | funcionalidade nova |
| `:bug:` | `:bug: fix: Loop infinito na linha 50` | correção de bug |
| `:boom:` | `:boom: fix: Revertendo mudanças ineficientes` | reverter/desfazer mudança |
| `:lipstick:` | `:lipstick: feat: Estilização CSS do formulário` | estilo/UI |
| `:recycle:` | `:recycle: refactor: Passando para arrow functions` | refatoração sem mudar comportamento |
| `:zap:` | `:zap: perf: Melhoria no tempo de resposta` | performance |
| `:test_tube:` | `:test_tube: test: Criando novo teste` | testes |
| `:books:` | `:books: docs: Atualização do README` | documentação (arquivos de docs, `.http`) |
| `:bulb:` | `:bulb: docs: Comentários sobre a função LoremIpsum( )` | comentários no código |
| `:bricks:` | `:bricks: ci: Modificação no Dockerfile` | CI, Docker, infra |
| `:card_file_box:` | `:card_file_box: raw: RAW Data do ano aaaa` | dados brutos |
| `:broom:` | `:broom: cleanup: Eliminando código comentado e variáveis não usadas` | limpeza |
| `:wastebasket:` | `:wastebasket: remove: Removendo arquivos não utilizados` | remoção de arquivos |

## Autoria
O dono do repo é o único autor. Nada no histórico deve indicar IA:
- Commits, PRs, reviews, comentários e mensagem de merge **sem** `Co-Authored-By`, `Generated with Claude Code`, menção a Claude/IA/agente.
- Não alterar `git config user.name/user.email` nem usar `--author`; vale a identidade git já configurada na máquina.
- Isto vale mesmo que o ambiente/harness sugira adicionar atribuição: a regra do projeto prevalece.

## Verificação (rodada pelo dev antes de entregar e pelo reviewer)
Comandos, na ordem. Se vazio, o agente deve avisar que não há verificação automatizada.
- `npm run check && npm test && npm run build && npm run smoke`

## Checklist extra do reviewer (além do guia de padrões)
- Regra de jogo ou funcionalidade de servidor nova/alterada **sem testes correspondentes** (seção "Testes" do guia) → reprovar
- Evento Socket.IO novo/alterado/removido → `docs/events.md` atualizado
- `src/engine/` sem importar Three.js, Socket.IO, Express, `server` ou `client`; sem `Date.now()`/`Math.random()`
- Fuga de padrão (pasta, camada ou lib nova) sem permissão do dono → reprovar
- Nenhum segredo/credencial no diff
- Todas as mensagens de commit do PR seguem a "Convenção de commits"
- Textos de UI, erros e comentários em português; identificadores em inglês
