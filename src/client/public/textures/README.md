# Texturas da cena

Nomes esperados (todos opcionais; sem o arquivo, o jogo usa o visual padrão):

- `background.png`: fundo da cena. Recomendado em proporção 16:9.
- `table.png`: textura da mesa, presente (1920x1320, 16:11, igual à da mesa; 4,7 MB). Recomendado manter 16:11.

Como são usadas:

- O fundo preenche a tela sem esticar (enquadramento "cover": o excesso da imagem é cortado nas bordas), então mantenha o assunto importante no centro.
- A mesa usa a imagem inteira no plano 16x11 com mapeamento direto (repeat 1x1) quando ela é 16:11; com outra proporção aplica o enquadramento "cover" centralizado (corta o excesso, sem esticar). A mesa carrega a textura com limite de largura 2048 px (as demais, 512 px). Quando a textura da mesa existe, as zonas ficam semi-transparentes para continuarem legíveis.
- Enquanto a imagem carrega, ou se ela faltar ou falhar, vale a cor padrão. Imagens largas são reduzidas na carga (limite de largura em `texturePaths.ts`).
