# Imagens das cartas

PNG com proporção 1030:1500 (retrato). O cliente reduz a largura na carga antes de enviar à GPU.

Nomes esperados:

- `back.png`: verso das cartas.
- Frente de cada carta: o arquivo apontado por `image` em `src/engine/cards.ts` (por padrão `<id>.png`, ex.: `ash_dragon.png`; a Esquiva da Glória Divina usa `esquiva_da_gloria_divina.png`).

Nenhum arquivo é obrigatório: sem ele, o jogo usa o desenho provisório.
