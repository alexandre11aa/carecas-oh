# Eventos Socket.IO

Formato `<domínio>:<ação>`. Veja as regras em `AGENTS.md`, seção "Eventos".

Objeto `room` usado nas respostas (nunca inclui tokens):

```json
{ "code": "X7K2", "players": [{ "nickname": "Ana", "connected": true }] }
```

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
{ "room": { "code": "X7K2", "players": [{ "nickname": "Ana", "connected": true }] }, "token": "3b0c...-uuid" }

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
{ "room": { "code": "X7K2", "players": [{ "nickname": "Ana", "connected": true }, { "nickname": "Bia", "connected": true }] }, "token": "9f1a...-uuid" }

### room:rejoin

Direção: cliente → servidor

Payload:
{ "token": "3b0c...-uuid" }

Reassocia o jogador do token à nova conexão (por exemplo, após recarregar a página).

Respostas: `room:rejoined` (para quem reconectou) e `room:updated` (para os demais da sala)
Erros: `INVALID_PAYLOAD`, `INVALID_TOKEN` (token desconhecido ou sala já removida)

### room:rejoined

Direção: servidor → cliente

Payload:
{ "room": { "code": "X7K2", "players": [...] }, "token": "3b0c...-uuid" }

### room:leave

Direção: cliente → servidor

Payload: nenhum

Remove o jogador da sala. Se a sala ficar vazia, ela é removida.

Respostas: `room:updated` para os jogadores restantes (nenhuma para quem saiu)
Erros: nenhum (sem efeito se o jogador não estiver em sala)

### room:updated

Direção: servidor → cliente

Payload:
{ "room": { "code": "X7K2", "players": [{ "nickname": "Bia", "connected": false }] } }

Enviado aos demais jogadores quando alguém entra, reconecta, sai ou perde a conexão (`connected: false`). Ao perder a conexão o jogador mantém a vaga para `room:rejoin`; a sala é removida se todos ficarem desconectados por mais de 60 segundos.

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
