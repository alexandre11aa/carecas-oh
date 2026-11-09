# Sons

Efeitos em WAV mono PCM 16 bits, 32 kHz, cada um com no máximo 3 MB.

## Origem e aviso

Os efeitos são os sons do jogo Yu-Gi-Oh, de material oficial (Konami). Foram usados por decisão e risco do dono do projeto, que assume a responsabilidade quanto à regra de material próprio do `AGENTS.md`. Não são arte nem som originais do projeto e não têm licença de redistribuição.

Os originais (24 bits, estéreo, 44,1 ou 48 kHz) ficam fora do repositório, na pasta local `Desktop/sons` do dono.

## Arquivos

| Arquivo | Uso | Fonte |
|---|---|---|
| `activate`, `attack`, `damage`, `destroyed`, `draw`, `equip`, `flip`, `gainlp`, `nextturn`, `phase`, `set`, `summon` | Partida | Mesmos nomes na pasta de origem |
| `click` | Clique em botões e links de menu e lobby | `chatmessage.wav`, primeiros 0,4 s com fade-out |
| `confirm` | Criar, entrar, iniciar duelo e "Pronto" | `playerenter.wav`, primeiros 1,2 s com fade-out |

Conversão: mistura para mono, reamostragem para 32 kHz, corte, fade-out, normalização de pico em 0,85 e 16 bits.
