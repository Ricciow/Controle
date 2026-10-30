# ControlLab

Ferramenta interativa para análise de funções de transferência. Cadastre as suas funções por expressão, coeficientes ou polos e zeros, escolha a malha e explore os resultados.

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

## Análises disponíveis

- Função de transferência numérica e em função de K, com cópia em texto simples.
- Malha aberta e realimentação unitária negativa.
- Polos, zeros, estabilidade, resposta ao degrau e ao impulso.
- Lugar das raízes, seleção de K, verificador de coordenadas e método das distâncias.
- Routh-Hurwitz numérico e simbólico, com intervalos de estabilidade em função de K.
- Bode, Nyquist, margens e comparação de métricas entre sistemas.
- Análise de desempenho com varredura e comparação de ganhos, exportação de dados CSV e gráficos SVG.

As funções e as abas abertas são salvas no navegador.

## Desempenho

Ative **Desempenho** na barra superior e selecione uma das funções cadastradas. Não há planta pré-selecionada do exercício, requisitos obrigatórios ou relatórios com respostas prontas.

O painel usa ganho proporcional multiplicando toda a planta e realimentação unitária negativa. Para outras configurações, use os analisadores correspondentes da ferramenta.

- Ajuste K para observar os polos e medir sobressinal, acomodação de 2%, amortecimento e frequência natural.
- Compare as medidas da resposta completa com as aproximações baseadas nos polos dominantes.
- Defina limites de Mp/Ts apenas se desejar referências na tabela e no LGR. Os campos começam vazios.
- Em **Varredura de K**, escolha intervalo e quantidade de amostras. O resultado apresenta métricas em função do ganho, com gráfico selecionável, tabela paginada e exportação CSV. Não há escolha automática de ganho ótimo.
- Em **Comparação de ganhos**, digite os ganhos que deseja sobrepor. Não há quantidade mínima ou exemplos preenchidos.
- Configure a janela temporal, baixe os gráficos SVG ou leve os casos escolhidos aos gráficos principais.

A varredura avalia somente os pontos definidos. Valores ausentes não significam zero: podem indicar instabilidade, fronteira ou horizonte insuficiente para medir acomodação. Não se deduz viabilidade de intervalos contínuos a partir das amostras.

## Métodos e precisão

As raízes usam fórmulas para ordens 1/2 e Durand-Kerner nas ordens superiores, com reescala. O LGR resolve o polinômio característico em ganhos amostrados. Routh-Hurwitz e Nerdamer são usados na análise de estabilidade e na álgebra simbólica.

A resposta temporal é calculada por realização no espaço de estados e exponencial de matriz. No painel Desempenho, o passo temporal é de no máximo 0,01 s; o horizonte busca cobrir oito constantes de tempo dominantes e está limitado a 120 s. A janela exibida no gráfico é configurável e não substitui o horizonte das métricas. Aproximações de segunda ordem não certificam o comportamento de plantas de ordem superior.

A suíte de testes inclui plantas de ordens e entradas diferentes, respostas analíticas, limites opcionais, fronteiras de estabilidade, ganhos singulares e cancelamento de varreduras.
