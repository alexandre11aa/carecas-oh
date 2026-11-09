# Sons

Efeitos em WAV mono PCM 16 bits, 32 kHz. Músicas de fundo em OGG Vorbis estéreo, 32 kHz, em loop. Cada arquivo tem no máximo 3 MB.

## Origem e aviso

Os efeitos e as músicas são do jogo Yu-Gi-Oh, de material oficial (Konami). Foram usados por decisão e risco do dono do projeto, que assume a responsabilidade quanto à regra de material próprio do `AGENTS.md`. Não são arte nem som originais do projeto e não têm licença de redistribuição.

Os originais (24 bits, estéreo, 44,1 ou 48 kHz) ficam fora do repositório, na pasta local `Desktop/sons` do dono.

## Arquivos

| Arquivo | Uso | Fonte |
|---|---|---|
| `activate`, `attack`, `damage`, `destroyed`, `draw`, `equip`, `flip`, `gainlp`, `nextturn`, `phase`, `set`, `summon` | Partida | Mesmos nomes na pasta de origem |
| `click` | Clique em botões e links de menu e lobby; também a seleção de carta por clique na partida (mão e campo) | `chatmessage.wav`, primeiros 0,4 s com fade-out |
| `victory` | Fim da partida, para o vencedor (inclusive desistência do oponente e fim por tempo), uma vez | Faixa "You Win" (1-11) da trilha de Yu-Gi-Oh! Forbidden Memories, 7,9 s com fade-out |
| `defeat` | Fim da partida, para o perdedor, uma vez | Faixa "You Lose" (2-13) da mesma trilha, 9,2 s com fade-out |
| `confirm` | Criar, entrar, iniciar duelo e "Pronto" | `playerenter.wav`, primeiros 1,2 s com fade-out |

Fonte de `victory` e `defeat`: https://archive.org/details/yu-gi-oh-forbidden-memories-remastered-25th-anniversary (Internet Archive, MP3), pois a pasta `Desktop/sons` não tem som de vitória nem de derrota. Mesmo aviso de material oficial, sem licença de redistribuição, por decisão e risco do dono.

Conversão: mistura para mono, reamostragem para 32 kHz, corte, fade-out, normalização de pico em 0,85 e 16 bits.

## Músicas

| Arquivo | Uso | Fonte | Tamanho |
|---|---|---|---|
| `menu.ogg` | Home, guia e cartas | Faixa "Main Menu" de Yu-Gi-Oh! Forbidden Memories (trilha remasterizada, compositores Naoko Ishii, Waichiro Ozaki e Hiroshi Tanabe) | 0,84 MB |
| `lobby.ogg` | Sala de espera | Faixa "Build Deck Menu" da mesma trilha | 1,51 MB |
| `battle.ogg` | Partida (PvP e IA); para com fade no fim da partida e volta na revanche | Faixa "Free Duel" da mesma trilha | 2,47 MB |

Fonte: https://archive.org/details/yu-gi-oh-forbidden-memories-remastered-25th-anniversary (Internet Archive, MP3). Não há licença de redistribuição; o uso é por decisão e risco do dono do projeto.

Conversão: MP3 estéreo 44,1 kHz para OGG Vorbis estéreo, 32 kHz, corte do silêncio das pontas, normalização de pico em 0,85 e emenda do loop por crossfade de 1,5 s (o fim da faixa se mistura ao início, então o loop não tem corte audível). As músicas tocam com volume 0,15, abaixo dos efeitos (0,35).
