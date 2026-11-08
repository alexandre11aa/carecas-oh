# Carecas-Oh

Jogo de cartas 1x1 para navegador, em 3D simples, rápido de jogar e inspirado nos jogos antigos de Yu-Gi-Oh, com cartas, nomes e artes próprios. Não há contas: um jogador cria uma sala e o outro entra com um código ou link (`/sala/CODIGO`). Também é possível duelar sozinho contra a IA do servidor.

## Como se joga

- Dois jogadores, cada um com 4000 pontos de vida.
- Existem 6 decks fixos de 20 cartas (as cartas de cada deck repetidas: a magia exclusiva entra 1 vez e as demais de 1 a 3 vezes): Agressivo, Defensivo, Mágico, Controle, Equilibrado e Estratégico. Cada jogador escolhe o seu deck em segredo a cada partida; os decks só são revelados quando a partida começa (os dois podem escolher o mesmo).
- Mão inicial de 4 cartas; as outras 6 ficam no deck. Perde quem não puder comprar quando for obrigado a comprar, ou quem tiver a vida zerada.
- Turno em fases: Compra, Principal 1, Batalha, Principal 2 e Fim. No primeiro turno da partida ninguém ataca.
- **Monstros:** 5 zonas por jogador e 1 invocação normal por turno (ou baixar 1 monstro em defesa virada). Níveis 1 a 4 não exigem tributo, 5 e 6 exigem 1 tributo, 7 ou mais exigem 2 tributos (monstros do próprio campo, enviados ao cemitério). Cada monstro pode mudar de posição uma vez por turno e atacar uma vez por turno; ataque direto só quando o oponente não tem monstros.
- **Magias** são ativadas da mão nas fases Principais. **Armadilhas** são baixadas viradas e ativadas no turno do oponente, a partir do turno seguinte ao que foram baixadas.
- **Janela de resposta:** invocação, ataque e ativação de magia podem ser respondidos com uma armadilha, que resolve antes da ação original (uma resposta por janela).
- Cada turno tem 100 segundos para o jogador da vez (ou para o defensor, se houver janela de resposta aberta). Ao expirar, o servidor passa a resposta ou encerra o turno.
- Ao fim da partida, o resultado é exibido e os jogadores podem pedir **revanche** (precisa dos dois votos; os lados são trocados e cada um escolhe o deck de novo) ou voltar ao lobby.

### Duelar com a IA

Na home, o botão "Duelar com IA" pede o apelido, o nível (Fácil, Médio ou Difícil) e o seu deck. A partida começa na hora, sem sala de espera, e a IA recebe um deck sorteado. As regras são as mesmas; o limite de 100 segundos vale só para o humano. A IA joga no servidor, usando apenas a visão do próprio lado (nunca vê a sua mão).

As regras completas estão em [AGENTS.md](AGENTS.md).

## Arquitetura

Monolito em TypeScript: frontend, backend e regras do jogo em um único projeto, um único `package.json`, um único `Dockerfile` e um único serviço.

```text
src/engine/   Regras do jogo (funções puras, sem rede e sem interface) e IA
src/server/   Node.js + Express + Socket.IO + Zod
src/client/   HTML + CSS + Three.js + GSAP
docs/         Eventos Socket.IO e fluxo de agentes
```

O servidor é a autoridade: valida toda mensagem, aplica as jogadas pela engine e envia a cada jogador apenas a visão a que ele tem direito. O estado das partidas fica na memória do servidor, sem banco de dados.

| Parte | Tecnologia |
|---|---|
| Linguagem | TypeScript em modo estrito |
| Build do frontend | Vite |
| Cena 3D e animações | Three.js e GSAP |
| Interface | HTML e CSS, sem framework |
| Tempo real | Socket.IO |
| Servidor | Node.js + Express |
| Validação | Zod (servidor) |
| Testes | Vitest |
| Containers | Docker e Docker Compose |

## Como rodar

Requer Node.js (o `Dockerfile` usa a versão 22) e npm.

```bash
npm install
```

### Desenvolvimento: `npm run dev`

```bash
npm run dev
```

Atenção: `npm run dev` sobe **só o Vite** (frontend). O Vite encaminha `/socket.io` para `http://localhost:3000`, então para jogar é preciso ter o backend rodando nessa porta (veja abaixo).

### Servidor compilado

```bash
npm run build
node dist/server/server/index.js
```

O servidor escuta em `0.0.0.0`, na porta da variável `PORT` (padrão 3000), e serve o frontend compilado, o Socket.IO e o `/healthz`. Abra `http://localhost:3000`.

### Docker

```bash
docker compose up --build
```

Sobe o único serviço (`app`) em `http://localhost:3000`. O build da imagem roda `npm run check`, `npm test` e `npm run build`: teste quebrado impede a imagem.

> **Cuidado:** processos antigos ainda escutando na porta 3000 (um `node` esquecido ou um container anterior) continuam servindo código desatualizado. Se a partida se comportar como uma versão antiga, encerre esses processos e suba de novo.

## Verificação

```bash
npm run check   # checagem de tipos (tsc --noEmit)
npm test        # testes (Vitest)
npm run build   # build de produção
npm run smoke   # inicia o dist/server compilado e checa /healthz e room:create (rode após o build)
```

## Documentação

- [AGENTS.md](AGENTS.md): guia de código, arquitetura de pastas, padrões e regras do jogo.
- [docs/events.md](docs/events.md): eventos Socket.IO (direção, payload, respostas e erros).
- [docs/agent-loop/](docs/agent-loop/): fluxo de agentes e sprints (configuração em [config.md](docs/agent-loop/config.md)).

## Deploy e limitações

O deploy é um único Web Service do Render, no plano gratuito, com runtime Docker a partir do `Dockerfile` (o Render não usa o `docker-compose.yml`), com `/healthz` como health check.

- As partidas ficam na memória: reiniciar ou fazer deploy do servidor encerra as partidas em andamento, e o serviço roda em uma única instância.
- No plano gratuito, o serviço hiberna após 15 minutos sem requisições; o primeiro acesso depois disso demora mais e as partidas em memória se perdem.
- A reconexão por token permite voltar à partida após recarregar a página ou perder a conexão.
