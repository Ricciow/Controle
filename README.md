# ControlLab

Ferramenta interativa para análise de funções de transferência. Cadastre suas funções por expressão, coeficientes ou polos e zeros e escolha as análises na barra superior.

## Executar

Requer Node.js 20 ou superior e npm.

```sh
npm ci
npm run dev
```

Abra a URL informada pelo Vite. Para validar e produzir a versão estática:

```sh
npm test
npm run build
npm run preview
```

O workflow de GitHub Pages executa compilação e testes ao receber alterações em `master` ou `main`.

## Ferramentas

- Função de transferência numérica e em função de K, com cópia em texto simples.
- Malha aberta e realimentação unitária negativa.
- Polos, zeros, estabilidade, resposta ao degrau e ao impulso.
- Lugar das raízes, seleção de K, verificador de coordenadas e método das distâncias.
- Routh-Hurwitz numérico e simbólico, com intervalos de estabilidade em função de K.
- Bode, Nyquist, margens e tabela comparativa de métricas entre sistemas.
- Card Calcular K: selecione uma função e informe sobressinal máximo (%) e/ou tempo de acomodação máximo (banda de 2%). A busca numérica encontra um ganho positivo para realimentação unitária negativa e permite aplicá-lo à função. A faixa de K é ajustável; não encontrar um ganho na busca não prova inviabilidade fora dela. O cálculo usa a resposta ao degrau completa, sem aproximação de segunda ordem.

Para comparar ganhos, duplique a função, defina um K em cada cópia e observe as respostas e a tabela comparativa. O K selecionado no gráfico do LGR é independente do K de cada função.

As funções e as abas abertas são salvas no navegador.

## Expressões e margens no Bode

Ative **Mostrar assíntotas** no Bode para visualizar as contribuições do ganho, dos polos e dos zeros à magnitude e à fase. Desmarque **Mostrar curva exata** para estudar somente as assíntotas. O tracejado longo mostra a soma assintótica e o curto identifica cada componente na legenda abaixo do gráfico. Círculos, guias verticais e rótulos desenham os pontos de mudança com frequência em rad/s e valor da soma em dB ou graus; a legenda também oferece uma tabela com esses valores. Na fase, a aproximação linear vai de ωb/10 a 10ωb, com ±45°/década por raiz; fatores no eixo imaginário têm salto em ωb. O atraso puro contribui com 0 dB e sua fase exata em malha aberta; em malha fechada com atraso, as assíntotas usam a aproximação de Padé de ordem 4, identificada na legenda. A curva contínua mantém a resposta exata.

O modo expressão aceita parênteses e colchetes como agrupadores, vírgula ou ponto decimal e `e` como a constante de Euler. Exemplos:

```text
20^(-0,2s) / [s*(s+1)]
20*e^(-0,2s) / [s*(s+1)]
K / [s^2 + 0,2s + 1]
```

`20^(-0,2s)` equivale a `e^(-0,2*ln(20)*s)`; é diferente de `20*e^(-0,2s)`. Bases positivas com expoente linear em `s` são aceitas como fatores de atraso. Fatore o atraso fora de somas, como `e^(-0,2s)*(s+1)`. Nas listas de coeficientes (`[1, 2] / [1, 3, 2]`), a vírgula continua separando coeficientes e o ponto indica decimais.

Bode e Nyquist usam o atraso exponencial exato, inclusive ao aplicar zoom e realimentação unitária. As ferramentas que exigem polinômios (resposta temporal, polos, zeros, estabilidade, Routh, LGR e cálculo de K) usam Padé de ordem 4, com indicação no cartão da função. Mantenha o modo expressão para preservar o atraso; a cópia de uma malha aberta preserva o exponencial, enquanto a cópia de uma malha fechada com atraso fornece a aproximação de Padé.

O Bode exibe a margem de fase (MF), a margem de ganho (MG) e suas frequências de cruzamento para cada função visível. Os cruzamentos são refinados numericamente em frequência logarítmica, independentemente do zoom. Havendo vários cruzamentos, a margem mais próxima de zero é selecionada; a busca de fase considera −180° e seus equivalentes módulo 360°. Sem cruzamento de fase, MG é infinita; sem cruzamento de ganho, MF não possui frequência definida. A busca numérica cobre as escalas dos polos, zeros, ganho e atraso, dentro de 10⁻¹⁴ a 10¹⁴ rad/s.
