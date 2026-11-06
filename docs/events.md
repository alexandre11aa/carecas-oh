# Eventos Socket.IO

Formato `<domínio>:<ação>`. Veja as regras em `AGENTS.md`, seção "Eventos".

Objeto `room` usado nas respostas (nunca inclui tokens):

```json
{ "code": "X7K2", "players": [{ "nickname": "Ana", "connected": true, "ready": false }] }
```

`ready` indica quem marcou "pronto" na sala de espera.

O código tem 4 caracteres (letras maiúsculas sem I/O e dígitos 2-9). O `token` é um UUID aleatório, exclusivo de cada jogador, que o cliente guarda no `localStorage` para usar em `room:rejoin`.

## Sala

### room:create

Direção: cliente → servidor

Payload:
{ "nickname": "Ana" }

`nickname`: texto de 1 a 20 caracteres (espaços nas pontas são removidos).

Respostas: `room:created` (só para quem criou)
Erros: `INVALID_PAYLOAD`

### room:created

Direção: servidor → cliente

Payload:
{ "room": { "code": "X7K2", "players": [{ "nickname": "Ana", "connected": true, "ready": false }] }, "token": "3b0c...-uuid" }

### room:join

Direção: cliente → servidor

Payload:
{ "code": "X7K2", "nickname": "Bia" }

`code`: 4 caracteres alfanuméricos (aceita minúsculas). `nickname`: como em `room:create`.

Respostas: `room:joined` (para quem entrou) e `room:updated` (para os demais da sala)
Erros: `INVALID_PAYLOAD`, `ROOM_NOT_FOUND`, `ROOM_FULL`

### room:joined

Direção: servidor → cliente

Payload:
{ "room": { "code": "X7K2", "players": [{ "nickname": "Ana", "connected": true, "ready": false }, { "nickname": "Bia", "connected": true, "ready": false }] }, "token": "9f1a...-uuid" }

### room:rejoin

Direção: cliente → servidor

Payload:
{ "token": "3b0c...-uuid" }

Reassocia o jogador do token à nova conexão (por exemplo, após recarregar a página).

Respostas: `room:rejoined` (para quem reconectou), `match:state` (só se houver partida em andamento, com `events: []`) e `room:updated` (para os demais da sala)
Erros: `INVALID_PAYLOAD`, `INVALID_TOKEN` (token desconhecido ou sala já removida)

### room:rejoined

Direção: servidor → cliente

Payload:
{ "room": { "code": "X7K2", "players": [...] }, "token": "3b0c...-uuid" }

### room:leave

Direção: cliente → servidor

Payload: nenhum

Remove o jogador da sala. Se a sala ficar vazia, ela é removida. Se havia partida em andamento, ela é encerrada e todos voltam a "não pronto".

Respostas: `room:updated` para os jogadores restantes (nenhuma para quem saiu)
Erros: nenhum (sem efeito se o jogador não estiver em sala)

### room:updated

Direção: servidor → cliente

Payload:
{ "room": { "code": "X7K2", "players": [{ "nickname": "Bia", "connected": false, "ready": false }] } }

Enviado aos demais jogadores quando alguém entra, reconecta, sai ou perde a conexão (`connected: false`). Ao perder a conexão o jogador mantém a vaga para `room:rejoin`; a sala é removida se todos ficarem desconectados por mais de 60 segundos.

## Partida

### room:ready

Direção: cliente → servidor

Payload (opcional):
{ "ready": false }

Sem payload, marca o jogador como pronto. `{ "ready": false }` desmarca. Quando a sala tem 2 jogadores e ambos estão prontos e conectados, o servidor sorteia a semente (nunca enviada), cria a partida e envia `match:state` a cada jogador. Se o jogador desconecta antes de a partida começar, o "pronto" é desmarcado.

Respostas: `room:updated` (para toda a sala, inclusive quem enviou) e, ao iniciar, `match:state` (um por jogador, `events: []`)
Erros: `INVALID_PAYLOAD`, `NOT_IN_ROOM`, `MATCH_ALREADY_STARTED`

### match:action

Direção: cliente → servidor

Payload (união discriminada por `type`, espelha `Action` da engine):
{ "type": "SUMMON_CARD", "cardId": "ash_sprite", "tributeCardIds": [], "zone": 0 }

Tipos: `SUMMON_CARD`, `SET_MONSTER` (`cardId`, `tributeCardIds`, `zone` 0-4), `SET_SPELL_TRAP`, `CHANGE_POSITION`, `FLIP_SUMMON`, `ACTIVATE_TRAP` (`cardId`), `ACTIVATE_SPELL` (`cardId`, `targetZone` 0-4 opcional: zona do próprio campo em `BOOST_ATTACK`, do oponente em `DESTROY_MONSTER`), `ATTACK` (`attackerCardId`, `targetZone` 0-4 do oponente, ou null para ataque direto). Alvos vão por zona, nunca por id, para poder mirar monstros virados do oponente sem revelá-los (zona vazia ou fora de 0-4: `INVALID_TARGET`), `PASS_RESPONSE`, `NEXT_PHASE`, `END_TURN`. Campos extras (como um jogador) são rejeitados: o jogador é identificado pelo servidor pela conexão.

Respostas: `match:state` para cada jogador conectado da sala
Erros: `INVALID_PAYLOAD`, `NOT_IN_ROOM`, `MATCH_NOT_STARTED`, ou o código da engine (`NOT_YOUR_TURN`, `INVALID_PHASE`, `RESPONSE_PENDING`, `CARD_NOT_IN_HAND` etc., ver `ErrorCode` em `src/engine/types.ts`)

### match:state

Direção: servidor → cliente

Payload:
{ "view": { "viewer": "P1", "turn": 2, "currentPlayer": "P1", "phase": "MAIN_1", "winner": null, "you": { ... }, "opponent": { ... }, "pendingResponse": null }, "events": [{ "type": "CARD_DRAWN", "player": "P2", "cardId": null }] }

`view` é o resultado de `playerView` para o destinatário; `events` são os eventos da jogada passados por `eventView` (o servidor nunca envia `GameEvent` bruto). Para eventos do oponente, ids de cartas ocultas viram `null`: `CARD_DRAWN`, `MONSTER_SUMMONED`/`POSITION_CHANGED` com carta virada, `SPELL_TRAP_SET` e `cardId` de `ATTACK_BOOSTED` (que traz também `zone`). `ATTACK_DECLARED` e `SPELL_ACTIVATED` identificam o alvo por `targetZone`, público. Nunca inclui a semente nem a mão/deck do oponente. Enviado ao iniciar a partida (`events: []`), após cada ação válida e na reconexão (`events: []`, restaura o estado atual).

## Erros

### app:error

Direção: servidor → cliente

Payload:
{ "event": "room:join", "code": "ROOM_FULL" }

`event` é o evento do cliente que originou o erro. A interface escolhe a mensagem em português a partir do `code`.

| code | Quando |
|---|---|
| `INVALID_PAYLOAD` | A mensagem não passou na validação Zod |
| `ROOM_NOT_FOUND` | Não existe sala com o código informado |
| `ROOM_FULL` | A sala já tem 2 jogadores |
| `INVALID_TOKEN` | Token desconhecido ou sala removida |
| `NOT_IN_ROOM` | A conexão não pertence a nenhuma sala |
| `MATCH_NOT_STARTED` | `match:action` antes de a partida começar |
| `MATCH_ALREADY_STARTED` | `room:ready` com a partida em andamento |
| (códigos da engine) | Jogada inválida, por exemplo `NOT_YOUR_TURN` e `INVALID_PHASE` |
