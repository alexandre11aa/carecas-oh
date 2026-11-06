# AGENTS.md

Guia para agentes (e devs) que escrevem código neste repositório. Siga a arquitetura e os padrões abaixo em todo código novo. O projeto ainda não tem código: a primeira implementação de cada camada deve seguir este guia e passa a ser a referência para as seguintes.

## Regras de governança

- Código novo deve seguir a arquitetura de pastas e os padrões descritos aqui.
- Se for preciso fugir de qualquer padrão (pasta nova, camada nova, lib nova, estilo diferente), pare e peça permissão ao usuário antes, explicando o motivo.
- Prefira recursos nativos do navegador e do Node.js. Só adicione uma dependência quando ela evitar um trabalho relevante.
- Qualquer mudança aprovada na arquitetura ou nos padrões deve atualizar este arquivo na mesma tarefa.
- Todo evento Socket.IO novo, alterado ou removido deve ser refletido em `docs/events.md` (ver seção Eventos).
- Toda regra de jogo ou funcionalidade de servidor nova ou alterada entra com testes na mesma tarefa (ver seção Testes).
- Decisões em aberto (ver última seção) não devem ser assumidas: pergunte ao usuário.

## Visão geral

Jogo de cartas 1x1 para navegador, em 3D simples, rápido de jogar e inspirado nos jogos antigos de Yu-Gi-Oh, com cartas próprias. Não há contas: um jogador cria uma sala e o outro entra com um código ou link.

O projeto é um **monolito em TypeScript**: frontend, backend e regras do jogo ficam em um único projeto, com um único `Dockerfile`, um único `docker-compose.yml` e um único serviço.

```text
src/engine/   Regras do jogo, sem rede e sem interface
src/server/   Node.js + Express + Socket.IO
src/client/   HTML + CSS + Three.js
docs/         Documentação dos eventos
```

### Stack

| Parte | Tecnologia |
|---|---|
| Linguagem | TypeScript em modo estrito |
| Pacotes | npm, com um único `package.json` |
| Build do frontend | Vite |
| Cena 3D | Three.js |
| Animações | GSAP |
| Interface | HTML e CSS, sem framework |
| Tempo real | Socket.IO e Socket.IO Client |
| Servidor | Node.js + Express |
| Validação | Zod, apenas no servidor |
| Testes | Vitest |
| Armazenamento | Memória do servidor, sem banco de dados |
| Containers | Docker e Docker Compose |
| Hospedagem | Web Service gratuito do Render, com runtime Docker |

## Regras do jogo (versão inicial)

- Dois jogadores, cada um com 8000 pontos de vida e um deck pré-montado.
- Cada jogador começa com 5 cartas e compra 1 no início do próprio turno.
- O campo tem 5 zonas de monstro por jogador.
- Cada jogador pode invocar 1 monstro por turno, em ataque ou defesa.
- Monstros atacam uma vez por turno. A diferença entre os valores define o dano e os monstros destruídos.
- Vence quem zerar os pontos de vida do oponente ou quem restar quando o oponente não puder comprar.
- Não há cadeia de efeitos, armadilhas nem respostas no turno do oponente.

## Engine (`src/engine/`)

### Estrutura de pastas

```text
src/engine/
  cards.ts              definições das cartas, tipadas
  decks.ts              decks pré-montados
  types.ts              tipos de cartas, ações e estado da partida
  rules/                turnos, invocação e combate, um arquivo por assunto
  createMatch.ts        cria o estado inicial a partir dos decks e da semente
  applyAction.ts        (estado, ação) => resultado
  playerView.ts         filtra o estado visível a cada jogador
  index.ts              exportações públicas
```

### Padrão de código

- Não importa Three.js, Socket.IO, Express nem código de `server` ou `client`.
- Funções são puras: a mesma entrada produz a mesma saída, e o estado recebido nunca é alterado.
- Não usa `Date.now()` nem `Math.random()`. Aleatoriedade, como embaralhar o deck, usa uma semente guardada no estado.
- O estado e as ações são serializáveis em JSON.
- `applyAction` retorna `{ ok: true, state, events }` ou `{ ok: false, code }`. Jogadas inválidas fazem parte do fluxo e não lançam exceção.
- Ações são uma união discriminada pelo campo `type`, em `UPPER_SNAKE_CASE` (`SUMMON_CARD`, `ATTACK`, `END_TURN`).
- `playerView` é o único caminho para gerar dados enviados aos jogadores. A mão do oponente, a ordem dos decks e a semente nunca são incluídas.

### Cartas

- Cartas são dados tipados em `cards.ts`. Não crie uma classe nem um arquivo de código para cada carta.
- Use apenas cartas, artes, nomes e identidade visual próprios. Não copie material oficial de Yu-Gi-Oh.

```ts
{
  id: "ash_dragon",
  name: "Dragão de Cinzas",
  type: "MONSTER",
  attack: 1600,
  defense: 1200,
  image: "/cards/ash_dragon.webp",
  description: "Um dragão que renasce das próprias cinzas.",
}
```

## Backend (`src/server/`)

### Estrutura de pastas

```text
src/server/
  index.ts              inicia o Express, o Socket.IO e os arquivos estáticos
  sockets/
    handlers.ts         recebe e responde aos eventos
    schemas.ts          schemas Zod das mensagens recebidas
  services/
    roomService.ts      criar sala, entrar, reconectar e jogar
  store/
    roomStore.ts        salas e partidas em memória
```

### Padrão de código

| Camada | Faz | Não faz |
|---|---|---|
| Handler (`sockets/`) | Valida a mensagem com Zod, identifica o jogador, chama o service e emite as respostas | Regra de jogo ou acesso direto ao store |
| Service (`services/`) | Coordena sala, store e engine; verifica se o jogador pertence à sala | Conhecer detalhes do Socket.IO ou reimplementar regras do jogo |
| Store (`store/`) | Lê, grava e remove salas e partidas | Regra de negócio |
| Engine (`src/engine/`) | Decide se uma jogada é válida e calcula o novo estado | Rede ou armazenamento |

- Nomes de funções em `camelCase`, no formato `<ação><Entidade>`: `createRoom`, `joinRoom`, `submitAction`.
- Funções de service recebem um único objeto como argumento: `joinRoom({ code, nickname })`.
- O cliente nunca é confiável: toda mensagem passa pelo Zod, e o jogador é identificado pelo servidor, nunca por um campo enviado pelo cliente.
- Após cada jogada válida, cada jogador recebe o próprio resultado de `playerView`.
- Erros enviados ao cliente têm um `code` estável, e a interface escolhe a mensagem em português.
- O estado das partidas fica apenas em `store/`.

### Salas e reconexão

1. O jogador informa um apelido e cria uma sala.
2. O servidor gera um código curto e guarda a sala na memória.
3. O segundo jogador entra pelo código ou pelo link `/sala/CODIGO`.
4. Cada jogador recebe um token aleatório, salvo no `localStorage`, para voltar à partida após recarregar a página ou perder a conexão.
5. Salas encerradas ou abandonadas são removidas da memória.

## Frontend (`src/client/`)

### Estrutura de pastas

```text
src/client/
  index.html
  main.ts               escolhe a tela inicial pela URL
  state.ts              último estado recebido do servidor
  style.css
  public/cards/         imagens das cartas
  network/
    socket.ts           conexão, envio e recebimento de eventos
  screens/              telas em HTML: início, sala de espera e interface da partida
  scene/
    scene.ts            renderer, câmera, luzes e loop
    table.ts            mesa e zonas
    cardMesh.ts         criação e atualização das cartas
    monsterSprite.ts    arte do monstro em pé sobre a carta
  animations/           sequências GSAP: compra, invocação e ataque
```

### Padrão de código

- Sem framework de interface: telas são funções que criam e atualizam elementos do DOM.
- Arquivos em `camelCase.ts`. A primeira linha de cada arquivo é um comentário com o caminho: `// src/client/scene/cardMesh.ts`.
- O cliente importa de `src/engine/` apenas tipos e dados públicos das cartas. Nunca chama `applyAction` para decidir o resultado de uma jogada.
- A comunicação com o servidor passa por `network/socket.ts`.
- `state.ts` guarda o último estado do servidor. Estado visual, como carta selecionada, fica separado.
- Texto de interface, mensagens e comentários em português. Identificadores de código em inglês.

### Cena 3D

- Câmera em perspectiva sobre a mesa, com poucas luzes e sem sombras em tempo real.
- Cartas são planos com textura. A mesa usa geometria simples.
- Monstros invocados aparecem como uma imagem em pé sobre a carta, sem modelos 3D.
- Não adicione modelos 3D, motor de física ou pós-processamento sem permissão.
- Menus, mão, botões e textos longos ficam em HTML sobre a cena.
- Reaproveite geometrias, materiais e texturas entre cartas. Imagens de cartas usam WebP.
- A cena apenas representa o estado: animações não alteram regras nem decidem resultados.
- Ao receber um novo estado, a interface executa as animações em ordem e termina mostrando exatamente o estado do servidor.
- Uma reconexão interrompe as animações e restaura diretamente o estado atual.

## Eventos (`docs/events.md`)

Todo evento Socket.IO é documentado em `docs/events.md`.

- Eventos usam o formato `<domínio>:<ação>` (`room:create`, `room:join`, `match:action`, `match:state`, `app:error`).
- Cada evento informa direção, payload de exemplo, respostas e erros possíveis.

```markdown
### room:join

Direção: cliente → servidor

Payload:
{ "code": "X7K2", "nickname": "Alexandre" }

Respostas: `room:joined`
Erros: `ROOM_NOT_FOUND`, `ROOM_FULL`
```

## Testes

Os testes usam Vitest e ficam ao lado do código, em arquivos `*.test.ts`.

O que cobrir:

- **Engine:** cada regra, incluindo jogadas válidas e inválidas, e a garantia de que `playerView` não vaza informação oculta.
- **Server:** cada evento, incluindo caminho feliz, payload inválido, sala inexistente, jogador sem permissão e reconexão.
- **Client:** não há testes automatizados no início. A verificação mínima é `npm run check`, `npm run build` e uma partida manual em duas abas.
- **Correção de bug:** um teste que falharia antes da correção, quando o bug estiver em `engine` ou `server`.

Como escrever:

- Afirme o resultado exato e o estado final, não apenas que não houve erro.
- Use uma semente fixa nos testes que envolvem aleatoriedade.
- Dê nomes em português que descrevam o comportamento: `nao_permite_atacar_fora_do_turno`.

Não desative nem pule testes para fazer o build passar.

## Infra

### Arquivos

```text
Dockerfile              imagem única usada no Render e no ambiente local
docker-compose.yml      ambiente local, com um único serviço
.dockerignore
package.json
package-lock.json
tsconfig.json
vite.config.ts
```

### Docker

O `Dockerfile` é multi-stage: `build -> final`.

- `build`: roda `npm run check` e `npm test`, gera o frontend com o Vite e compila o servidor. Teste quebrado impede a criação da imagem.
- `final`: contém apenas os arquivos compilados e as dependências de produção.

O container executa um único processo Node.js, que atende tudo na mesma porta:

```text
Navegador ──> Express + Socket.IO (porta definida em PORT)
                ├── /            frontend compilado
                ├── /socket.io   tempo real
                └── /healthz     health check
```

- Existe apenas um `docker-compose.yml`, com um único serviço. Não crie arquivos Compose separados por ambiente.
- O servidor escuta em `0.0.0.0`, na porta definida pela variável `PORT`.
- Frontend e backend têm a mesma origem, então a produção não precisa de CORS.
- Rotas como `/sala/CODIGO` devolvem o `index.html`.
- Fora do Docker, o servidor de desenvolvimento do Vite encaminha `/socket.io` para o backend.
- Mudança na arquitetura de deploy é fuga de padrão: peça permissão.

### Render

- Criar um único Web Service no plano gratuito, com runtime Docker, a partir do `Dockerfile`. O Render não usa o `docker-compose.yml`.
- Configurar `/healthz` como health check.

### Comandos

```bash
docker compose up --build   # sobe o projeto localmente
npm run dev                 # desenvolvimento fora do Docker
npm run check               # checagem de tipos (tsc --noEmit)
npm test                    # testes
npm run build               # build de produção
```

Antes de entregar uma tarefa, rode `npm run check`, `npm test` e `npm run build`.

## Limitações conhecidas

- Um reinício ou deploy do servidor encerra as partidas em andamento.
- Enquanto as partidas ficarem na memória, o serviço roda em uma única instância.
- No plano gratuito do Render, o serviço hiberna após 15 minutos sem requisições HTTP ou mensagens WebSocket recebidas. Ao hibernar, as partidas na memória se perdem.
- O primeiro acesso após a hibernação demora mais, então a interface deve exibir um estado de carregamento.
- Conexões podem cair durante a partida, então a reconexão por token precisa funcionar desde o início.

## Decisões em aberto

- [ ] Quantas cartas terá cada deck e quais serão as cartas iniciais?
- [ ] Qual será a identidade visual do jogo (tema, cores e estilo das cartas)?
