# Eventos Socket.IO

Formato `<domínio>:<ação>`. Veja as regras em `AGENTS.md`, seção "Eventos".

Objeto `room` usado nas respostas (nunca inclui tokens):

```json
{ "code": "X7K2", "hasMatch": false, "players": [{ "nickname": "Ana", "connected": true, "ready": false }] }
```

`ready` indica quem marcou "pronto" na sala de espera.

`hasMatch` é o sinal explícito para o cliente manter ou descartar a partida: `true` enquanto a sala guarda uma partida (em andamento ou encerrada, inclusive depois que o oponente desiste com `OPPONENT_LEFT`, quando `ready` volta a `false` para todos); `false` quando a sala está sem partida (antes de começar ou depois que um novo jogador entra numa sala com partida encerrada). O cliente descarta o `match` só quando recebe `hasMatch: false`, e nunca deduz isso de `ready`. Vale em todos os eventos que carregam `room`: `room:created`, `room:joined`, `room:rejoined` e `room:updated`.

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
{ "room": { "code": "X7K2", "hasMatch": false, "players": [{ "nickname": "Ana", "connected": true, "ready": false }] }, "token": "3b0c...-uuid" }

Em salas contra a IA (`room:createAi`) o `room` traz também `vsAi: true` e `aiLevel` (`easy`, `medium` ou `hard`), e `hasMatch` já é `true`. Esses dois campos só existem nessas salas (ausentes nas demais) e valem em todos os eventos que carregam `room` (`room:created`, `room:rejoined`, `room:updated`):

{ "room": { "code": "X7K2", "hasMatch": true, "players": [{ "nickname": "Ana", "connected": true, "ready": false }], "vsAi": true, "aiLevel": "medium" }, "token": "3b0c...-uuid" }

### room:createAi

Direção: cliente → servidor

Payload:
{ "nickname": "Ana", "level": "medium", "deckId": "magic" }

`nickname`: como em `room:create`. `level`: `easy`, `medium` ou `hard`. `deckId`: um dos 6 decks (`aggressive`, `defensive`, `magic`, `control`, `balanced`, `strategic`), secreto como em `room:ready`.

Cria uma sala contra a IA e já inicia a partida: sem sala de espera nem "pronto". O humano é o P1 e a IA o P2 (a IA não é um jogador da sala: não aparece em `players`, não tem token enviado ao cliente). O servidor sorteia o deck da IA entre os 6 e quem começa (pela semente, como no PvP); a semente nunca sai do servidor. A sala não aparece em `lobby:rooms`, `room:join` nela devolve `ROOM_FULL` e `room:ready` devolve `MATCH_ALREADY_STARTED`. `room:rejoin` restaura a partida como no PvP. `room:leave` (ou o abandono por desconexão) remove a sala.

A IA joga no servidor: quando o turno (ou a janela de resposta) é dela, o servidor espera 700 ms (`aiDelayMs`) e joga **uma ação por vez**, sempre por `applyAction`; cada ação gera um `match:state` ao humano, com `events` filtrados por `eventView` (a mão e a semente da IA nunca saem), para ele animar em ordem. A IA também responde às janelas de resposta abertas pelo humano (ativa uma armadilha ou passa) e o humano responde às dela pelo fluxo normal (`match:action`). Na vez da IA (inclusive na janela dela) o `turnDeadline` do `match:state` é `null` e o prazo de 30 s não corre nem expira; ao voltar ao humano, o prazo recomeça. Há um limite de ações por turno (`MAX_AI_ACTIONS_PER_TURN`); perto dele a IA só encerra o turno. A vitória ou derrota da IA gera `outcome` e `match:ended` como no PvP. O agendamento da IA é cancelado quando o humano sai (`room:leave`), a sala é removida ou a partida termina.

Respostas: `room:created` (só para quem criou) seguido do `match:state` inicial (`events: []`)
Erros: `INVALID_PAYLOAD` (apelido, nível ou deck inválidos; não há `INVALID_DECK` separado, como em `room:ready`)

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
{ "room": { "code": "X7K2", "hasMatch": false, "players": [{ "nickname": "Ana", "connected": true, "ready": false }, { "nickname": "Bia", "connected": true, "ready": false }] }, "token": "9f1a...-uuid" }

### room:rejoin

Direção: cliente → servidor

Payload:
{ "token": "3b0c...-uuid" }

Reassocia o jogador do token à nova conexão (por exemplo, após recarregar a página).

Respostas: `room:rejoined` (para quem reconectou), `match:state` (só se houver partida em andamento, com `events: []` e o `turnDeadline` vigente) e `room:updated` (para os demais da sala)
Erros: `INVALID_PAYLOAD`, `INVALID_TOKEN` (token desconhecido ou sala já removida)

### room:rejoined

Direção: servidor → cliente

Payload:
{ "room": { "code": "X7K2", "hasMatch": false, "players": [...] }, "token": "3b0c...-uuid", "deckId": "magic" }

`deckId` (só neste evento) é a escolha de deck do próprio jogador (feita em `room:ready` ou no voto de `match:rematch`), ou `null` se não há escolha pendente, para a interface refletir a seleção após reconectar. Nunca traz o deck do oponente. Perder a conexão antes do início desmarca "pronto" e descarta a escolha.

### room:leave

Direção: cliente → servidor

Payload: nenhum

Volta ao lobby: remove o jogador da sala; se a sala ficar vazia, ela é removida. Quem ficou volta a "não pronto". Decisão sobre a partida:

- **Partida em andamento:** sair é desistência. Quem ficou vence com motivo `OPPONENT_LEFT` e recebe `match:state` (`winner` preenchido, evento `MATCH_ENDED`) e `match:ended`. A partida encerrada fica na sala só para ele ver o resultado; não há revanche sem oponente (`REMATCH_UNAVAILABLE`).
- **Partida já encerrada (tela de fim):** o resultado permanece para quem ficou, os votos de revanche são apagados e o restante recebe `match:ended` atualizado.
- Se outro jogador entrar numa sala com partida encerrada, a partida antiga é descartada e a sala volta ao estado de espera (todos "não pronto").
- Perder a conexão (sem `room:leave`) não é desistência: o lugar é mantido para `room:rejoin`.
- **Sala contra a IA (`vsAi`):** só há um humano, então sair (no meio da partida ou depois do fim) remove a sala na hora, cancela o agendamento da IA e esquece o seu estado. A desistência equivale a derrota do humano, mas ninguém resta para receber `match:state`/`match:ended` com `OPPONENT_LEFT`. Perder a conexão não remove a sala: a IA segue jogando no turno dela (sem entregas enquanto o humano estiver fora) e o humano volta com `room:rejoin`, inclusive com a partida encerrada (recebe `match:ended`). A sala de IA abandonada é removida pelo mesmo tempo de abandono das demais.

Respostas: `room:updated` para os jogadores restantes (nenhuma para quem saiu) e, se havia partida, `match:state`/`match:ended` para quem ficou
Erros: nenhum (sem efeito se o jogador não estiver em sala)

### room:updated

Direção: servidor → cliente

Payload:
{ "room": { "code": "X7K2", "hasMatch": false, "players": [{ "nickname": "Bia", "connected": false, "ready": false }] } }

Nunca traz o deck escolhido por nenhum jogador (a escolha é secreta até a partida começar; o mesmo vale para `room:created`, `room:joined` e `lobby:rooms`).

Enviado aos demais jogadores quando alguém entra, reconecta, sai ou perde a conexão (`connected: false`). Ao perder a conexão o jogador mantém a vaga para `room:rejoin`; a sala é removida se todos ficarem desconectados por mais de 60 segundos.

## Lobby

Lista de salas abertas. "Sala aberta" = 1 jogador, conectado, sem partida; sala cheia, com partida ou cujo anfitrião perdeu a conexão não aparece. Entrar por código (`room:join`) continua possível para qualquer sala.

### lobby:subscribe

Direção: cliente → servidor

Payload: nenhum

Coloca a conexão no room Socket.IO "lobby" e responde com a lista atual. Quem cria ou entra numa sala (`room:create`, `room:join`, `room:rejoin`) sai do lobby automaticamente.

Respostas: `lobby:rooms`
Erros: `INVALID_PAYLOAD` (se enviar qualquer payload)

### lobby:unsubscribe

Direção: cliente → servidor

Payload: nenhum

Tira a conexão do lobby. Sem efeito se não estava assinada.

Respostas: nenhuma
Erros: `INVALID_PAYLOAD` (se enviar qualquer payload)

### lobby:rooms

Direção: servidor → cliente

Payload:
{ "rooms": [{ "code": "X7K2", "hostNickname": "Ana" }] }

Salas contra a IA nunca aparecem aqui. Lista completa de salas abertas (vazia quando não há nenhuma). Enviada em resposta a `lobby:subscribe` e, aos assinantes, sempre que a lista muda: sala criada, sala que enche, sala removida, host que perde ou recupera a conexão, sala que ganha partida. Os itens trazem só `code` e `hostNickname`: nunca tokens nem ids de conexão.

## Partida

### room:ready

Direção: cliente → servidor

Payload:
{ "deckId": "magic" }

ou, para desmarcar (o `deckId` pode ser omitido):
{ "ready": false }

`deckId` é obrigatório ao marcar pronto e deve ser um dos 6 decks fixos: `aggressive`, `defensive`, `magic`, `control`, `balanced`, `strategic`. Sem payload, sem `deckId` ou com valor desconhecido a mensagem é recusada com `INVALID_PAYLOAD`. O deck é sempre do jogador identificado pelo servidor (token); nenhum campo indica de quem é. A escolha fica no servidor, secreta para o oponente (`room:updated` e demais eventos da sala não a trazem), e é descartada ao desmarcar, ao perder a conexão antes do início, ao sair e ao iniciar a partida. Os dois jogadores podem escolher o mesmo deck. Depois do início, ambos os decks aparecem em `match:state` (`you.deckId` e `opponent.deckId`). Quando a sala tem 2 jogadores e ambos estão prontos e conectados, o servidor sorteia a semente (nunca enviada), cria a partida e envia `match:state` a cada jogador. Se o jogador desconecta antes de a partida começar, o "pronto" é desmarcado.

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
{ "view": { "viewer": "P1", "turn": 2, "currentPlayer": "P1", "phase": "MAIN_1", "winner": null, "you": { ... }, "opponent": { ... }, "pendingResponse": null }, "events": [{ "type": "CARD_DRAWN", "player": "P2", "cardId": null }], "turnDeadline": 1767225630000, "serverNow": 1767225600000 }

`view` é o resultado de `playerView` para o destinatário; `events` são os eventos da jogada passados por `eventView` (o servidor nunca envia `GameEvent` bruto). Para eventos do oponente, ids de cartas ocultas viram `null`: `CARD_DRAWN`, `MONSTER_SUMMONED`/`POSITION_CHANGED` com carta virada, `SPELL_TRAP_SET` e `cardId` de `ATTACK_BOOSTED` (que traz também `zone`). `CARD_RETURNED_TO_HAND` (monstro devolvido à mão; traz `zone` e `faceDown`) tem o `cardId` oculto de quem não é o dono quando o monstro estava virado. `ATTACK_DECLARED` e `SPELL_ACTIVATED` identificam o alvo por `targetZone`, público. Nunca inclui a semente nem a mão/deck do oponente. Enviado ao iniciar a partida (`events: []`), após cada ação válida (inclusive cada ação jogada pela IA numa sala `vsAi`, uma por mensagem), quando o prazo do turno expira e na reconexão (`events: []`, restaura o estado atual).

`turnDeadline` e `serverNow` (ambos em ms, públicos, acrescentados na camada de entrega, fora da engine) controlam o limite de tempo: o jogador do turno tem 30 segundos para agir; com `pendingResponse` aberta, o tempo conta para o defensor. O cliente calcula o tempo restante por `turnDeadline - serverNow` (não depende do relógio local). Regras do servidor:

- O prazo recomeça (30 s) no início de cada turno e **após cada ação válida**; jogada inválida não renova.
- Ao expirar, o servidor joga por conta própria e envia `match:state` aos dois com os eventos filtrados: `END_TURN` do jogador do turno (na fase de compra, antes avança a fase, o que faz a compra) ou, com resposta pendente, `PASS_RESPONSE` do defensor (o prazo é renovado; se expirar de novo, `END_TURN`).
- O prazo continua correndo se o jogador desconectar. Na reconexão, `match:state` traz o `turnDeadline` vigente.
- Em sala contra a IA o prazo só existe na vez do humano: quando quem deve agir (jogador do turno ou defensor) é a IA, `turnDeadline` é `null` e nada expira.
- O prazo é cancelado (`turnDeadline: null`) quando a partida termina, em desistência e quando a sala é removida; a revanche abre um prazo novo. Se a expiração encerrar a partida (por exemplo, compra sem cartas), `match:ended` segue o `match:state`.

### match:rematch

Direção: cliente → servidor

Payload:
{ "deckId": "control" }

ou, para retirar o voto (o `deckId` pode ser omitido):
{ "accept": false }

Só vale com a partida encerrada. `{ "deckId": "..." }` vota por revanche com o deck escolhido (obrigatório ao aceitar, mesmos 6 ids de `room:ready`; sem ele ou inválido: `INVALID_PAYLOAD`); `{ "accept": false }` retira o voto e descarta a escolha. A escolha é do jogador do token, secreta para o oponente (o `match:ended` de revanche só mostra quem votou) e usada na nova partida: cada deck acompanha o seu jogador mesmo com os lados trocados. Com os votos dos dois jogadores (ambos conectados), o servidor cria uma nova partida: novo embaralhamento dos decks com nova semente (nunca enviada), vida em 8000, e os lados P1/P2 são trocados. Um só voto não inicia nada. Não é preciso passar por `room:ready`. Se o oponente já saiu da sala, não há revanche.

**Sala contra a IA (`vsAi`):** a IA sempre aceita, então não há espera nem `REMATCH_UNAVAILABLE`. `{ "deckId": "..." }` (obrigatório, validado como no PvP) inicia a nova partida na hora: nova semente, vida em 8000, lados P1/P2 trocados (quem começa segue o sorteio da nova semente), nível da IA mantido e novo deck aleatório da IA, sorteado no servidor e nunca enviado. O humano escolhe o seu deck de novo a cada revanche. `{ "accept": false }` apenas descarta a escolha de deck: a partida continua encerrada, o jogador recebe `match:ended` (com `rematch.opponent: true`) e pode votar de novo ou sair com `room:leave`. Não entra segunda pessoa na sala (`ROOM_FULL`).

Respostas: `match:ended` para os dois (votos atualizados) ou, quando a partida recomeça, `match:state` para cada jogador (`events: []`, `winner: null`)
Erros: `INVALID_PAYLOAD`, `NOT_IN_ROOM`, `MATCH_NOT_STARTED`, `MATCH_NOT_ENDED`, `REMATCH_UNAVAILABLE`

### match:ended

Direção: servidor → cliente

Payload:
{ "winner": "P2", "reason": "DECK_OUT", "rematch": { "you": true, "opponent": false } }

Estado de fim, enviado a cada jogador conectado quando a partida termina (logo depois do `match:state` da jogada final), a cada voto de revanche retirado ou dado, na saída do oponente, ao perder a conexão (o voto some) e na reconexão com a partida já encerrada. `winner` é `P1` ou `P2` (compare com `view.viewer` do `match:state`). `reason`: `LIFE_ZERO` (vida do perdedor chegou a 0), `DECK_OUT` (perdedor sem carta para comprar) ou `OPPONENT_LEFT` (o oponente saiu com `room:leave`). `rematch` indica quem já votou por revanche (`you` é o próprio destinatário). Na sala contra a IA, `rematch.opponent` é sempre `true` (a IA aceita qualquer revanche), para o botão ficar habilitado.

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
| `ROOM_FULL` | A sala já tem 2 jogadores, ou é uma sala contra a IA (`room:join` nunca entra nela) |
| `INVALID_TOKEN` | Token desconhecido ou sala removida |
| `NOT_IN_ROOM` | A conexão não pertence a nenhuma sala |
| `MATCH_NOT_STARTED` | `match:action` antes de a partida começar |
| `MATCH_ALREADY_STARTED` | `room:ready` com a partida em andamento (inclusive em sala contra a IA, que já nasce com partida) |
| `MATCH_NOT_ENDED` | `match:rematch` com a partida em andamento |
| `REMATCH_UNAVAILABLE` | `match:rematch` sem o oponente na sala (nunca em sala contra a IA) |
| (códigos da engine) | Jogada inválida, por exemplo `NOT_YOUR_TURN` e `INVALID_PHASE` |
