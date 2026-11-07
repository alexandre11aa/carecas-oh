---
description: Ciclo completo — sprint → requirements → dev → revisão → (merge). Uso /cycle <pedido> (sem pedido = continuar a sprint)
argument-hint: <descrição do pedido | vazio para continuar>
---

Pedido: $ARGUMENTS

Leia e siga `docs/agent-loop/cycle.md` e `docs/agent-loop/config.md`, relativos à raiz do repositório.

Conduza as perguntas com `AskUserQuestion`.
Delegue aos agentes `requirements`, `dev` e `reviewer` com a Agent tool, sequencialmente.
