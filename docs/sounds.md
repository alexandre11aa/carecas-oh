# Sons e efeitos da partida

Fonte: pasta `sons` da área de trabalho fornecida pelo dono. A seleção considera o nome do efeito, sua duração e os eventos existentes no jogo. Não foi feita uma avaliação auditiva humana nesta implementação.

Os 12 arquivos selecionados ficam em `src/client/public/sounds/`. Foram convertidos para WAV PCM 16 bits, mono, 32 kHz, com média dos canais e reamostragem com filtro (`scipy.signal.resample_poly`). Total anterior: 4.434.939 bytes; total do jogo: 1.250.436 bytes (71,8% menor). Nenhuma biblioteca de áudio foi adicionada ao aplicativo: a reprodução usa Web Audio nativo.

| Arquivo | Duração original | Uso |
|---|---:|---|
| draw | 1,15 s | Carta comprada, inclusive compra oculta, sem revelar identidade |
| nextturn | 1,76 s | Início do turno |
| phase | 0,79 s | Mudança de fase |
| summon | 2,56 s | Invocação de monstro virado para cima |
| set | 0,62 s | Monstro em defesa virada ou magia/armadilha baixada |
| flip | 0,94 s | Virada ou mudança de posição |
| activate | 2,79 s | Magia ou armadilha ativada |
| equip | 1,85 s | Reforço de ataque |
| attack | 1,69 s | Projétil da declaração de ataque resolvida |
| damage | 2,08 s | Impacto em monstro após o projétil, ou dano aos pontos de vida confirmado pelo servidor |
| destroyed | 1,78 s | Carta enviada ao cemitério, incluindo magia usada e tributo |
| gainlp | 1,52 s | Vida recuperada |

`addcounter`, `removecounter`, `chatmessage`, `coinflip` e `diceroll` não têm mecânicas correspondentes. `playerenter` é de sala, fora da apresentação da partida. `shuffle` não tem evento de embaralhamento próprio; `specialsummon` não é distinguido de invocação normal nos eventos atuais. Esses oito sons não foram copiados para evitar downloads sem uso ou áudio que anuncie algo incorreto.

O jogo não possui pontos de vida individuais de monstros. O som `damage` no impacto indica contato de combate; destruição usa o evento de cemitério, e dano ao jogador exige `DAMAGE_DEALT`. Não há cálculo de resultado no cliente.

O botão “Som: ligado/desligado” persiste a escolha. O navegador exige um gesto (clique/toque/tecla) antes do primeiro áudio; o primeiro gesto na partida prepara o contexto e pré-carrega os buffers. Falha de arquivo, bloqueio de áudio ou armazenamento indisponível não impedem o duelo. Volume interno 35%, até quatro vozes simultâneas. Um som que demore mais de 180 ms para carregar é descartado para não tocar fora de hora.

Sons, avisos e efeitos seguem a mesma fila de eventos, sem reproduzir a conexão inicial/reconexão. Ocultar a aba interrompe a fila; eventos recebidos em segundo plano atualizam o estado sem tocar. Reconexão, revanche e saída cancelam efeitos e vozes. A cena usa projétil com rastro, impacto/escudo, carta indo ao cemitério e realce de dano/cura; o HUD usa vinheta vermelha de dano. Com movimento reduzido, não há trajetória de carta/projétil nem vinheta, apenas realces estáticos curtos e avisos.
