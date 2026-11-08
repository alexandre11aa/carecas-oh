# Imagens das cartas

WebP otimizado com proporção 1030:1500 (retrato), na resolução original para o detalhe. O cliente reduz a largura na carga antes de enviar à GPU. PNG também é aceito para futuras artes ainda não convertidas.

Nomes esperados:

- `verso.webp`: verso das cartas.
- Frente de cada carta: o arquivo apontado por `image` em `src/engine/cards.ts`. As artes de Controle usam o nome atual em snake_case sem acentos e extensão `.webp`, por exemplo `peido_fatal.webp`. Cartas ainda sem arte preservam o caminho provisório `<id>.png` e o fallback.

Originais, receita de exportação e tamanhos: `docs/decks/README.md` (fora dos arquivos públicos).

Nenhum arquivo é obrigatório: sem ele, o jogo usa o desenho provisório.
