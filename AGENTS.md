# AGENTS.md

Guia para agentes (e devs) que escrevem código neste repositório. Siga a arquitetura e os padrões abaixo em todo código novo. Use as implementações existentes como referência, respeitando este guia.

## Regras de governança

- Código novo deve seguir a arquitetura de pastas e os padrões descritos aqui.
- Se for preciso fugir de qualquer padrão (pasta nova, camada nova, lib nova, estilo diferente), pare e peça permissão ao usuário antes, explicando o motivo.
- Prefira recursos nativos do navegador e do Node.js. Só adicione uma dependência quando ela evitar um trabalho relevante.
- Qualquer mudança aprovada na arquitetura ou nos padrões deve atualizar este arquivo na mesma tarefa.
- Todo evento Socket.IO novo, alterado ou removido deve ser refletido em `docs/events.md` (ver seção Eventos).
- Toda regra de jogo ou funcionalidade de servidor nova ou alterada entra com testes na mesma tarefa (ver seção Testes).
- Decisões em aberto (ver última seção) não devem ser assumidas: pergunte ao usuário.

## Fluxo de agentes (Claude e Codex)

- As regras compartilhadas ficam em `docs/agent-loop/`; `config.md` é a única configuração de projeto do loop.
- Claude: `/cycle <pedido>` e `/sprint [status|nova|encerrar]`, com adaptadores em `.claude/commands/` e `.claude/agents/`.
- Codex: `$cycle <pedido>` e `$sprint [status|nova|encerrar]`, com skills de invocação explícita em `.agents/skills/` e agentes em `.codex/agents/`. Inicie uma nova sessão após alterar essas definições para que sejam descobertas.
- A invocação do loop autoriza delegação sequencial a requirements, dev e reviewer e as operações previstas no procedimento, mantendo suas confirmações obrigatórias. Pedidos comuns de desenvolvimento não iniciam o loop automaticamente.
- GitHub e branches existentes guardam o progresso compartilhado. Consulte issues, PRs e milestones ao retomar, antes de criar novos artefatos.
- `.claude/settings.json` configura apenas o Claude. O Codex usa as permissões de seu ambiente; não desative sandbox ou proteções para executar o loop.
- Instruções superiores e restrições do ambiente prevalecem sobre este guia.

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

## Regras do jogo

Seguem as regras do Yu-Gi-Oh, com monstros, magias, armadilhas e tributo.

### Pontos de vida e decks

- Dois jogadores, cada um com 8000 pontos de vida.
- Existem 6 decks fixos de 10 cartas (`DECKS` em `decks.ts`): Agressivo 6/3/1, Defensivo 5/2/3, Mágico 4/5/1, Controle 4/3/3, Equilibrado 5/3/2 e Estratégico 5/4/1 (monstros/magias/armadilhas). Cada carta pertence a um só deck e cada deck tem ao menos uma magia de efeito exclusivo. Cada jogador usa um deck (os dois podem usar o mesmo), embaralhado com a semente do estado.
- Mão inicial de 5 cartas; as outras 5 ficam no deck.
- Perde quem não puder comprar quando for obrigado a comprar.
- Cada turno tem limite de 30 segundos para o jogador da vez (ou o defensor, se houver janela de resposta aberta). O prazo recomeça a cada ação válida. Ao expirar, o servidor passa a resposta pendente ou encerra o turno. O relógio vive no servidor (`roomService`), nunca na engine.
- Vence também quem zerar os pontos de vida do oponente.

### Fases do turno

1. **Compra (Draw):** o jogador do turno compra 1 carta.
2. **Principal 1 (Main 1):** invocar, baixar, mudar posição e usar magias.
3. **Batalha (Battle):** monstros em ataque podem atacar. No primeiro turno da partida ninguém ataca (o servidor recusa com `ATTACK_NOT_ALLOWED_ON_FIRST_TURN`).
4. **Principal 2 (Main 2):** o mesmo que na Principal 1, respeitando os limites do turno.
5. **Fim (End):** o turno passa ao oponente.

### Monstros

- O campo tem 5 zonas de monstro por jogador.
- Cada jogador pode fazer 1 invocação normal por turno (ou baixar 1 monstro em defesa virada, que conta como a invocação normal do turno).
- **Tributo:** monstros de nível 1 a 4 não exigem tributo; nível 5 a 6 exigem 1 tributo; nível 7 ou mais exigem 2 tributos. Os tributos são monstros do próprio campo, enviados ao cemitério.
- **Baixar em defesa virada:** o monstro entra de face para baixo, na posição de defesa.
- **Mudança de posição:** uma vez por turno por monstro, na Principal, entre ataque e defesa. Um monstro não muda de posição no turno em que foi invocado nem depois de atacar. Um monstro virado vira-se para cima ao mudar para ataque.
- **Combate:** cada monstro em ataque ataca uma vez por turno. Ataque contra ataque: a diferença entre os valores de ATK é o dano ao dono do monstro mais fraco, que é destruído (empate destrói ambos). Ataque contra defesa: compara-se o ATK com a DEF; se o ATK for maior, o monstro em defesa é destruído sem dano aos pontos de vida; se for menor, o atacante sofre a diferença como dano. Ataque direto só é permitido quando o oponente não tem monstros.

### Magias e armadilhas

- **Magia:** ativada da mão pelo jogador do turno, nas fases Principais, com efeito imediato; depois vai ao cemitério.
- **Armadilha:** baixada virada na zona de magia/armadilha e ativada no turno do oponente, a partir do turno seguinte ao que foi baixada.
- **Janela de resposta:** quando o jogador do turno faz uma ação que pode ser respondida (invocação, ataque ou ativação de magia), o jogo abre uma janela em que o oponente decide ativar ou não uma armadilha. O efeito da armadilha resolve antes da ação original. Na Sprint 1 só existe uma resposta por janela: cadeia com múltiplos efeitos não é suportada. No motor, a ação interrompida fica guardada em `pendingResponse` do estado (sem ser aplicada); só o defensor age, com `ACTIVATE_TRAP` ou `PASS_RESPONSE`, e a ação original é retomada depois (a menos que o efeito a cancele). Gatilhos: declaração de ataque, invocação (`SUMMON_CARD`) e ativação de magia. Os efeitos das armadilhas são dados tipados (`TrapEffect`) em `cards.ts`, interpretados em `rules/traps.ts`.

## Fluxo da partida

1. **Lobby:** o jogador informa um apelido e cria uma sala ou entra por código/link.
2. **Sala:** os dois jogadores ficam na sala de espera.
3. **Pronto:** cada jogador escolhe um dos 6 decks fixos e marca "pronto"; a partida começa quando ambos estiverem prontos. A escolha é secreta até o início (ver Backend).
4. **Partida 3D:** jogada conforme as regras acima, na cena 3D com interface em HTML.
5. **Fim:** exibe o resultado e oferece **revanche** (reembaralha: reembaralha o deck de cada jogador com nova semente, e reinicia a vida em 8000) ou **voltar ao lobby**.

## Engine (`src/engine/`)

### Estrutura de pastas

```text
src/engine/
  cards.ts              definições das cartas, tipadas
  decks.ts              os 6 decks fixos de 10 cartas (`DECKS`, `DeckId`, `getDeck`)
  types.ts              tipos de cartas, ações e estado da partida
  rules/                turnos, invocação e combate, um arquivo por assunto
  createMatch.ts        cria o estado inicial a partir dos decks e da semente
  applyAction.ts        (estado, ação) => resultado
  playerView.ts         filtra o estado visível a cada jogador
  eventView.ts          filtra os eventos (GameEvent) visíveis a cada jogador
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
- `playerView(state, viewer)` devolve `you` (mão e campo completos, deck só como `deckCount`) e `opponent` (contagem de mão/deck; monstros e magias/armadilhas virados viram `cardId: null`, sem `attackBonus`/`hasAttacked`). Públicos: vida, fase, turno, cemitérios e, nos monstros virados para cima, `attackBonus`, `hasAttacked` e `changedPositionOnTurn`; `deckId` de ambos os jogadores (`you.deckId` e `opponent.deckId`) também é público, pois a partida só existe depois da revelação dos decks. `pendingResponse` aparece como `{ responder, canRespond: false }` para o jogador do turno; só o defensor recebe gatilho e ação interrompida (alvos de ataque e magia vão por zona; ids de tributos virados são removidos). Todo campo novo do estado exige decidir aqui se é público.
- `eventView(event, viewer)` é o único caminho de eventos aos jogadores: o servidor nunca envia `GameEvent` bruto. Ids de cartas ocultas do oponente viram `null` (compra, monstro baixado/mudado de posição virado, magia/armadilha baixada, reforço de ataque; alvos de ataque e magia são por zona, públicos). Evento novo que carregue `cardId` exige decidir aqui se é público.

### Cartas

- Cartas são dados tipados em `cards.ts`. Não crie uma classe nem um arquivo de código para cada carta.
- Efeitos de magia são dados tipados (`effect` em `SpellCard`, união `SpellEffect` em `types.ts`: `BOOST_ATTACK`, `HEAL`, `DAMAGE`, `DESTROY_MONSTER`, `DRAW`, `BOOST_ALL_ATTACK`, `HEAL_PER_MONSTER`, `REVIVE_MONSTER`, `DESTROY_SPELL_TRAP`, `DRAIN`, `BOUNCE_MONSTER`), interpretados por `rules/spells.ts`. Efeito novo = novo `kind` na união e um caso no interpretador, nunca código por carta.
- Balanceamento (régua): a composição de cada deck é fixa e testada em `decks.test.ts` (monstros/magias/armadilhas), sem sorteio por categoria. `DESTROY_MONSTER` e `DESTROY_ATTACKER` aceitam `maxAttack` opcional (ATK com bônus). `arcane_draw` continua "compre 1 carta": o risco de deck vazio antes da hora é decisão consciente.
- Balanceamento (simulação): `src/engine/balance.test.ts` joga, com um bot simples e fixo (só no arquivo de teste) e sementes fixas, todos os confrontos deck x deck nos dois lados (200 partidas por confronto ordenado). Critério: taxa de vitória média de cada deck contra os outros entre 45% e 55%, e nenhum confronto fora de 35%-65%. Rode `BALANCE_REPORT=1 npx vitest run src/engine/balance.test.ts -t imprime` para ver a tabela. Ao mexer em cartas ou decks, o teste deve continuar passando; ajuste ATK/DEF/valores de efeito (dentro da régua) e as descrições, nunca o teste. O bot só usa `DRAW` com a mão quase vazia, pois em decks de 10 cartas comprar a mais antecipa a derrota por deck vazio.
- Use apenas cartas, artes, nomes e identidade visual próprios. Não copie material oficial de Yu-Gi-Oh.

```ts
{
  id: "ash_dragon",
  name: "Dragão de Cinzas",
  type: "MONSTER",
  attack: 1600,
  defense: 1200,
  image: "/cards/ash_dragon.png",
  description: "Um dragão que renasce das próprias cinzas.",
}
```

## Backend (`src/server/`)

### Estrutura de pastas

```text
src/server/
  index.ts              inicia o Express, o Socket.IO e os arquivos estáticos
  app.ts                createApp: monta Express, Socket.IO e estáticos sem escutar porta (testável)
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
- Após cada jogada válida, cada jogador recebe `match:state` com o próprio `playerView` e os eventos filtrados por `eventView`. A semente é gerada no servidor e nunca sai dele.
- Escolha secreta de deck: `room:ready` e `match:rematch` (ao aceitar) levam `deckId` (Zod: enum dos 6 ids, obrigatório ao marcar pronto/aceitar). O deck é do jogador identificado pelo token e fica em `Room.players[i].deckId` (a revanche reaproveita o campo); é limpo ao iniciar partida/revanche, ao desmarcar/retirar o voto, ao perder a conexão sem partida e ao sair. `room:updated`, `room:created`, `room:joined` e `lobby:rooms` nunca o incluem; só `room:rejoined` devolve ao próprio jogador a sua escolha. Depois do início, ambos os decks saem via `playerView`.
- A partida (estado completo) fica em `Room.match` no store; o lado (P1/P2) de cada jogador vem do token, nunca da mensagem.
- Erros enviados ao cliente têm um `code` estável, e a interface escolhe a mensagem em português.
- O estado das partidas fica apenas em `store/`.
- Fim de partida: `Room.match` guarda `outcome` (vencedor e motivo) e `rematchVotes`; a partida encerrada continua na sala até a revanche (`match:rematch`, precisa dos dois votos, troca os lados e reembaralha o deck escolhido por cada jogador) ou a saída. `room:leave` no meio da partida é desistência (o outro vence com `OPPONENT_LEFT`); perder a conexão não é. Detalhes em `docs/events.md`.

### Salas e reconexão

1. O jogador informa um apelido e cria uma sala.
2. O servidor gera um código curto e guarda a sala na memória.
3. O segundo jogador entra pelo código ou pelo link `/sala/CODIGO`. Cada jogador marca "pronto" para iniciar a partida (ver "Fluxo da partida").
4. Cada jogador recebe um token aleatório, salvo no `localStorage`, para voltar à partida após recarregar a página ou perder a conexão.
5. Salas encerradas ou abandonadas são removidas da memória.

## Frontend (`src/client/`)

### Estrutura de pastas

```text
src/client/
  index.html
  main.ts               escolhe a tela pela URL (rotas via `routes.ts`, navegação com `history.pushState` + `popstate`)
  state.ts              último estado recebido do servidor
  style.css
  public/cards/         imagens das cartas (PNG 1030:1500)
  public/textures/      fundo e mesa (PNG, opcionais)
  public/decks/         imagens dos botões de deck da sala de espera (PNG, <deckId>.png)
  public/favicon-32.png, icon-192.png, apple-touch-icon.png   ícones da aba (logo reduzido, na raiz de public/; referenciados em index.html com caminho absoluto)
  network/
    socket.ts           conexão, envio e recebimento de eventos
  screens/              telas em HTML: início, sala de espera e interface da partida
    matchActions.ts     lógica pura (testável): PlayerView + seleção => comandos e `match:action` a enviar
    matchEnd.ts         lógica pura: textos de resultado, estado do botão de revanche (exige deck escolhido) e payload de `match:rematch`
    deckSelect.ts       lógica pura (testável): decks para exibir (id, nome, imagem), deck da partida (`deckOptionFor`), seleção, botão "Pronto" e payload de `room:ready`
    deckPicker.ts       componente HTML dos botões de imagem de deck (sala de espera e revanche)
    cardDetail.ts       lógica pura: textos de nome, tipo, ATK/DEF, efeito e mecânica da carta e carta visível num slot
    hero.ts             componente HTML do título temático com cartas decorativas (home, Guia e Cartas)
    cardView.ts         componente HTML de carta, reutilizável (partida e tutorial)
    matchNotices.ts     lógica pura: EventView (de `eventView`) => avisos de interface em ordem (carta, invocação, cemitério, dano/cura, fim); fila e animação ficam em `matchScreen.ts`
    routes.ts           lógica pura: pathname => página (`/`, `/guia`, `/cartas`, `/sala/CODIGO`; desconhecida => `/`) e URL após sair da sala; `FOOTER_LINKS` define os links do rodapé
    footer.ts           DOM do rodapé de navegação (menu, guia, cartas), usando `FOOTER_LINKS` de `routes.ts`
    loadingTracker.ts   lógica pura: contador de recursos pendentes do carregamento (`track`/`settle`/`pending`/`isReady`, assinatura, `reset`) com timeout de segurança injetável (`LOADING_TIMEOUT_MS`, 10 s)
    toasts.ts           lógica pura: toasts de erro (fila, dedup do mesmo erro visível, expiração, limite de empilhamento, dispensa) e armazém global; `socket.ts` e as telas só chamam `showErrorCode`/`showErrorMessage`
    toastView.ts        DOM dos toasts (`role="alert"`, botão de dispensar), montado uma vez em `main.ts` e persistente na troca de telas; animação em `hudEffects.ts`
    tutorialSections.ts lógica pura: seções do guia (dados tipados), catálogo de cartas agrupado por deck (composição e magia de efeito único), visibilidade e seção ativa
    tutorialScreen.ts   DOM das páginas `/guia` (menu de âncoras, blocos lista/tabela, seção ativa) e `/cartas` (catálogo por deck)
    scrollButton.ts     lógica pura: botão fixo único que alterna entre descer ao fim e subir ao topo (`pickScrollTarget`: `top`, `bottom` ou `null` sem rolagem) e rótulos
    scrollButtonView.ts DOM do botão fixo de subir/descer (só em `/guia` e `/cartas`, via `createPage`): usa `scrollButton.ts`, `scrollTo` com `auto`/`smooth` conforme `prefers-reduced-motion`, remove listeners no `destroy`
  scene/
    scene.ts            renderer, câmera, luzes e loop
    layout.ts           lógica pura (sem WebGL, testável): PlayerView -> posições das cartas na mesa e clique -> slot (`pickSlot`)
    table.ts            mesa com moldura e zonas
    tableDesign.ts      lógica pura (testável): medidas, cores por tipo de zona e degradê do fundo padrão
    cardMesh.ts         criação e atualização das cartas
    textures.ts         loadTexture: carrega PNG com cache, redução e fallback (null)
    blackHole.ts        vórtice decorativo atrás da mesa (planos com textura em canvas, rotação lenta, parado com prefers-reduced-motion)
    blackHoleDesign.ts  lógica pura (testável): camadas, posição e ângulo do vórtice
    texturePaths.ts     caminhos das texturas e tamanho alvo (lógica pura, testável)
    monsterSprite.ts    arte do monstro em pé sobre a carta
  animations/           sequências GSAP: compra, invocação e ataque
    hudEffects.ts       GSAP do HUD: aviso de evento, variação flutuante e barra de vida
```

### Padrão de código

- Sem framework de interface: telas são funções que criam e atualizam elementos do DOM.
- Arquivos em `camelCase.ts`. A primeira linha de cada arquivo é um comentário com o caminho: `// src/client/scene/cardMesh.ts`.
- O cliente importa de `src/engine/` apenas tipos e dados públicos das cartas. Nunca chama `applyAction` para decidir o resultado de uma jogada.
- A comunicação com o servidor passa por `network/socket.ts`.
- `state.ts` guarda o último estado do servidor, inclusive a última visão da partida (`match`, vinda de `match:state`); a tela da partida (`screens/matchScreen.ts`) abre quando ela existe e a cena apenas a representa. Monstros virados do oponente (`cardId: null`) aparecem como carta de costas.
- `state.ts` guarda o último estado do servidor. Estado visual, como carta selecionada, fica separado.
- Todo erro (`app:error`, conexão, cópia, validação de formulário) aparece como toast; as telas não têm linha de erro própria.
- Texto de interface, mensagens e comentários em português. Identificadores de código em inglês.

### Cena 3D

- Câmera em perspectiva sobre a mesa, com poucas luzes e sem sombras em tempo real.
- Cartas são planos com textura. A mesa usa geometria simples.
- Monstros invocados aparecem como uma imagem em pé sobre a carta, sem modelos 3D.
- Não adicione modelos 3D, motor de física ou pós-processamento sem permissão.
- Menus, mão, botões e textos longos ficam em HTML sobre a cena.
- Reaproveite geometrias, materiais e texturas entre cartas. Imagens de cartas usam PNG.
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
- **Client:** a lógica pura (`scene/layout.ts`, `screens/matchActions.ts`, `screens/matchEnd.ts`, `screens/matchNotices.ts`, `screens/scrollButton.ts`, `screens/loadingTracker.ts`, `state.ts`) tem testes; DOM e WebGL não. Mantenha a decisão de qual ação enviar nos módulos puros. A verificação mínima é `npm run check`, `npm run build` e uma partida manual em duas abas.
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
- Rotas como `/sala/CODIGO`, `/guia` e `/cartas` (estas duas com ou sem barra final) devolvem o `index.html`; rotas desconhecidas seguem sem fallback. O Vite em desenvolvimento já atende essas rotas com o fallback SPA padrão.
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
npm run smoke               # inicia o dist/server compilado e checa /healthz e room:create (rode após o build)
```

Antes de entregar uma tarefa, rode `npm run check`, `npm test`, `npm run build` e `npm run smoke`.

**Imports com extensão `.js`:** o `tsconfig.json` usa `module`/`moduleResolution` `NodeNext`, porque o `tsc` emite ESM que o Node executa direto. Todo import relativo em `src/` (engine, server e client) leva extensão `.js` mesmo apontando para um `.ts` (`import { x } from "./types.js"`), e pastas importam o `index.js` explicitamente (`./rules/index.js`). O Vite e o Vitest resolvem isso normalmente. Sem a extensão, o `npm run check` falha.

## Limitações conhecidas

- Um reinício ou deploy do servidor encerra as partidas em andamento.
- Enquanto as partidas ficarem na memória, o serviço roda em uma única instância.
- No plano gratuito do Render, o serviço hiberna após 15 minutos sem requisições HTTP ou mensagens WebSocket recebidas. Ao hibernar, as partidas na memória se perdem.
- O primeiro acesso após a hibernação demora mais, então a interface deve exibir um estado de carregamento.
- Conexões podem cair durante a partida, então a reconexão por token precisa funcionar desde o início.
- Cadeia com múltiplos efeitos (vários efeitos encadeados e respondidos entre si) fica fora da Sprint 1; há apenas uma resposta de armadilha por janela.
- As cartas do jogo são provisórias.

## Decisões em aberto

- [ ] Quais serão as 20 cartas definitivas (monstros, magias e armadilhas) e seus efeitos?
- [ ] Qual será a identidade visual do jogo (tema, cores e estilo das cartas)?
- [ ] Como será a cadeia com múltiplos efeitos (sprint futura)?
