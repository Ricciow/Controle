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
- Card de sobressinal: selecione uma função para visualizar Mp em porcentagem, calculado pela análise existente da resposta ao degrau. O valor acompanha as alterações da função, de K e da realimentação. Respostas sem valor final estável são identificadas.

Para comparar ganhos, duplique a função, defina um K em cada cópia e observe as respostas e a tabela comparativa. O K selecionado no gráfico do LGR é independente do K de cada função.

As funções e as abas abertas são salvas no navegador.
