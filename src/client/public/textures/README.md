# Texturas da cena

Nomes esperados (todos opcionais; sem o arquivo, o jogo usa o visual padrão):

- `background.png`: fundo da cena. Recomendado em proporção 16:9.
- `table.png`: textura da mesa. Recomendado em proporção 16:11, igual à da mesa.

Como são usadas:

- O fundo preenche a tela sem esticar (enquadramento "cover": o excesso da imagem é cortado nas bordas), então mantenha o assunto importante no centro.
- A mesa usa a imagem inteira no plano 16x11; com proporção diferente de 16:11 ela é esticada. Quando a textura da mesa existe, as zonas ficam semi-transparentes para continuarem legíveis.
- Enquanto a imagem carrega, ou se ela faltar ou falhar, vale a cor padrão. Imagens largas são reduzidas na carga (limite de largura em `texturePaths.ts`).
