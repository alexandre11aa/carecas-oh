---
name: sprint
description: Consulta ou gerencia as sprints deste repositório quando o usuário invoca $sprint com status, nova ou encerrar.
---

Leia `docs/agent-loop/config.md` e `docs/agent-loop/sprint.md` a partir da raiz do repositório e siga o procedimento compartilhado. O argumento após $sprint é a ação; sem argumento, use status. Quando precisar preparar integração, delegue ao reviewer.

Use as ferramentas disponíveis no Codex para perguntas e delegação. Se não houver ferramenta de perguntas apropriada, faça a pergunta diretamente ao usuário e aguarde a resposta. Se subagentes não estiverem disponíveis, informe o impedimento e pare; não substitua silenciosamente a revisão independente.

Invocar esta skill autoriza as operações Git/GitHub previstas no procedimento, respeitando os portões e confirmações obrigatórias. Não execute o fluxo apenas porque alguém pediu para editar seus arquivos. Permissões de execução e restrições do ambiente continuam valendo; não são importadas de `.claude/settings.json`.
