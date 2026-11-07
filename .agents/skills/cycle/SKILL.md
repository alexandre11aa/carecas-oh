---
name: cycle
description: Executa o ciclo de sprint, requisitos, implementação e revisão deste repositório quando o usuário invoca $cycle.
---

Leia `docs/agent-loop/config.md` e `docs/agent-loop/cycle.md` a partir da raiz do repositório e siga o procedimento compartilhado. O texto após $cycle é o pedido; sem texto, continue a sprint. Leia também `docs/agent-loop/sprint.md`. Delegue sequencialmente aos subagentes `requirements`, `dev` e `reviewer`, definidos em `.codex/agents/`; não implemente nem revise na thread principal.

Use as ferramentas disponíveis no Codex para perguntas e delegação. Se não houver ferramenta de perguntas apropriada, faça a pergunta diretamente ao usuário e aguarde a resposta. Se subagentes não estiverem disponíveis, informe o impedimento e pare; não substitua silenciosamente a revisão independente.

Invocar esta skill autoriza as operações Git/GitHub previstas no procedimento, respeitando os portões e confirmações obrigatórias. Não execute o fluxo apenas porque alguém pediu para editar seus arquivos. Permissões de execução e restrições do ambiente continuam valendo; não são importadas de `.claude/settings.json`.
