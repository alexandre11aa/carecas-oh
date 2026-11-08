# Artes originais e imagens do jogo

Os PNGs originais de Controle ficam em `control/`, e o verso em `shared/`. São cópias byte a byte das artes anteriores, com os nomes atuais das cartas. Para os próximos decks, preserve os originais em uma pasta com o `deckId` antes de gerar os arquivos de jogo. Estas pastas não são públicas e ficam fora do contexto Docker.

O jogo usa `src/client/public/cards/<nome_atual_em_snake_case>.webp`. Os ids de regras não mudam: apenas `image` em `src/engine/cards.ts` aponta para o novo arquivo. Nomes sem acentos, pontuação ou espaços; `Está em 80%` vira `esta_em_80.webp`.

Conversão reproduzível, com Python e Pillow instalado na máquina de preparação (sem dependência nova no aplicativo):

```text
python docs/decks/optimize.py
```

WebP com qualidade 86 e método 6, mantendo as dimensões dos originais (1030×1500). A cena continua reduzindo a textura para largura 512 ao enviá-la à GPU; a mão e o detalhe usam o WebP na resolução completa. Para novos decks, acrescente seu id à lista de pastas no script e confira a arte inteira e os textos antes de substituir os arquivos públicos.

| Artes | PNG anterior | WebP do jogo | Redução |
|---|---:|---:|---:|
| Controle (10 cartas) | 29.293.994 bytes | 3.013.170 bytes | 89,7% |
| Verso | 3.817.709 bytes | 504.696 bytes | 86,8% |
| Total | 33.111.703 bytes | 3.517.866 bytes | 89,4% |

O tamanho de transferência cai sem reduzir a resolução. O original permanece disponível para futuras exportações. As cartas dos outros decks ainda sem arte mantêm o fallback de texto.

O detalhe intermitente não depende apenas de carregamento: em telas até 70rem, o painel anterior entrava no fluxo e deslocava a mão ao aparecer; o hover também usava só o retângulo da zona, menor que as laterais da carta em defesa. Agora o painel fica sobre a mesa, a detecção prioriza a geometria real e o hover é reavaliado após atualizar estado/DOM, mesmo com o ponteiro parado. Texto de fallback continua disponível enquanto a arte carrega.
