# Sprint 10 — artes, interação e apresentação da partida

## Entregas

- #255: dez artes de Controle e verso exportados para WebP, nomes atuais nos arquivos e referências atualizadas, com os PNGs originais preservados byte a byte em `docs/decks`. A documentação e o conversor estão em `docs/decks/README.md` e `optimize.py`. O hover da mesa passa a usar a geometria real das cartas antes das zonas; o detalhe fica fora do fluxo em todas as larguras, e hover/foco são reconciliados quando muda o estado ou a mão. A correção de interação independe da compressão.
- #256: doze sons da pasta fornecida, convertidos para mono PCM 16 bits/32 kHz, mapeados aos eventos filtrados. Web Audio nativo, preferência de som persistida, desbloqueio por gesto, quatro vozes no máximo, falha silenciosa de áudio sem interromper o jogo e cancelamento de reprodução pendente na reconexão. Mapeamento, durações e motivos para não usar os demais sons em `docs/sounds.md`.
- #257: aviso de nenhuma sala aberta ocupa e centraliza seu conteúdo no espaço restante do painel; a lista vazia não consome esse espaço. A lista com salas conserva sua rolagem.
- #258: projétil com rastro, impacto, escudo em defesa, carta viajando ao cemitério e realces de dano/cura na mesa, mais vinheta de dano no jogador. Som, aviso e efeito seguem uma fila única. Origem por zona quando identificável; eventos ambíguos usam origem neutra. Movimento reduzido evita deslocamentos e vinheta. Reconexão, saída, revanche e aba oculta cancelam a apresentação; excesso de fila restaura diretamente o estado atual.

Não houve alteração nas regras, efeitos das cartas, eventos Socket.IO ou permissões de informação. As novas pastas aprovadas e os módulos de apresentação estão descritos no `AGENTS.md`.

## Verificação

- `npm run check`, `npm test`, `npm run build`, `npm run smoke` executados nesta tarefa. A suíte tem 809 testes aprovados e um teste de relatório já marcado como ignorado antes destas mudanças. Foram adicionados testes de mapeamento de eventos, cópias em zonas diferentes, dados ocultos, áudio bloqueado, silenciamento, cancelamento, falhas e limite de vozes, além da existência e tamanho das artes públicas.
- Chrome headless com WebGL: hover da mão estável em 1280×900, 900×900 e 390×900; arte do detalhe carregada; hover na lateral da carta em defesa fora da largura da zona; remoção da carta com ponteiro parado limpa o detalhe; lote de ataque/cemitério/dano termina em LP 3200 conforme a visão recebida. Nenhuma exceção JavaScript. Aviso de salas vazias centralizado no espaço disponível abaixo do título, lista vazia com `display: none`.
- Partida com servidor real em duas abas/contextos isolados do Chrome: criação/entrada, escolha de Controle, início, invocação sincronizada nos dois lados, troca de turno, recarga/reconexão no turno 2 (zero eventos antigos e aviso oculto) e desistência. Nenhuma exceção JavaScript.
- Inspeção visual do WebP em resolução completa: texto e arte preservados. A avaliação dos sons foi por identificação/duração e testes de integração; não houve audição humana.

O Vite continua emitindo aviso de bundle JavaScript acima de 500 kB por conter Three.js; isso não impede o build. Os originais não entram no contexto Docker, e os testes só exigem os arquivos públicos que também existem nesse contexto.

## Correção #260 — botão de som

O controle de som usa somente um ícone SVG próprio de alto-falante: ondas quando ligado, risco diagonal quando silenciado. Compartilha a altura de Desistir e mantém nome acessível, estado `aria-pressed`, foco de teclado e a preferência persistida de áudio.

Verificação: check, 809 testes (um relatório previamente ignorado), build e dois smoke aprovados. Conferência em Chrome headless nas larguras 1280 e 390 px, nos dois estados: som e Desistir medem 33,59375 px de altura; o botão não tem texto visível, o SVG muda corretamente, e nome acessível/estado alternam. Screenshot de 390 px silenciado inspecionada visualmente. Nenhuma exceção JavaScript, inclusive ao destruir a tela.

## Correção #261 — cópias na mão

A seleção visual da mão agora identifica a ocorrência por `handIndex`, além do `cardId`. Clicar na outra cópia transfere o destaque; repetir o clique na mesma ocorrência o limpa. O mesmo tratador atende a ativação nativa por teclado. Apenas o botão selecionado recebe a classe de destaque e `aria-pressed="true"`. O índice não vai para a engine ou para o servidor: ações continuam usando os ids atuais e removendo uma cópia por vez.

Cada nova visão do servidor limpa a seleção, como antes, impedindo que o destaque migre para outra cópia ao comprar, usar ou remover cartas. Comandos também rejeitam uma seleção que já não corresponda à posição da mão recebida. Os testes puros cobrem troca entre cópias, alternância da mesma ocorrência, payload sem índice visual, índices inválidos e seleção obsoleta após remoção/substituição.

A reconciliação também protege a tela contra chamadas recursivas do loading: uma imagem já em cache pode concluir sincronamente enquanto os botões estão sendo criados. Nesse caso, a nova atualização aguarda o render atual terminar, e atualizações agendadas não executam depois de destruir a tela.

Verificação automatizada: check, 812 testes aprovados (um relatório previamente ignorado), build e dois smoke aprovados.

Verificação no Chrome: primeira e segunda cópias ficam selecionadas individualmente ao clicar; repetir o clique limpa a seleção; Enter seleciona a segunda e Espaço a desmarca. Remover a primeira cópia com cache quente limpa o destaque sem recursão; comprar outra cópia e selecioná-la destaca somente seu novo índice. `aria-pressed` acompanha os estados. Nenhuma exceção JavaScript ou erro ao destruir a tela.
