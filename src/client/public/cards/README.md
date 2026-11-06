# Imagens das cartas

PNG com proporção 1030:1500 (retrato). O cliente reduz a largura na carga antes de enviar à GPU.

Nomes esperados:

- `back.png`: verso das cartas.
- `<id>.png`: frente de cada carta, onde `<id>` é o `id` em `src/engine/cards.ts` (ex.: `ash_dragon.png`).

Nenhum arquivo é obrigatório: sem ele, o jogo usa o desenho provisório.
