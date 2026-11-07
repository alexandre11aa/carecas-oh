# Texturas da cena

Nomes esperados (todos opcionais; sem o arquivo, o jogo usa o visual padrão):

- `background.png`: fundo da cena. Recomendado em proporção 16:9.
- `fundo.png`: fundo das páginas em HTML (home, guia, cartas, sala de espera e carregamento), 1672x941 (16:9; 3,7 MB). Usado em CSS (`style.css`) com enquadramento "cover" centralizado, camada escura leve e degradê padrão como reserva. Não é usado na partida nem na cena 3D.
- `table.png`: textura da mesa, presente (1920x1320, 16:11, igual à da mesa; 4,7 MB). Recomendado manter 16:11.

Atrás da mesa há ainda um vórtice decorativo (buraco negro) gerado em código, com texturas desenhadas em canvas; não precisa de arquivo. Fica parado com `prefers-reduced-motion` e, se o canvas falhar, vale o fundo acima.

Como são usadas:

- O fundo preenche a tela sem esticar (enquadramento "cover": o excesso da imagem é cortado nas bordas), então mantenha o assunto importante no centro.
- A mesa usa a imagem inteira no plano 16x11 com mapeamento direto (repeat 1x1) quando ela é 16:11; com outra proporção aplica o enquadramento "cover" centralizado (corta o excesso, sem esticar). A mesa carrega a textura com limite de largura 2048 px (as demais, 512 px). Quando a textura da mesa existe, as zonas ficam semi-transparentes para continuarem legíveis.
- Enquanto a imagem carrega, ou se ela faltar ou falhar, vale a cor padrão. Imagens largas são reduzidas na carga (limite de largura em `texturePaths.ts`).
