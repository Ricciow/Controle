# ControlLab

Aplicativo React/TypeScript para funções de transferência, polos e zeros, LGR, respostas temporais, Bode, Nyquist e Routh-Hurwitz.

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

## Projeto de desempenho com ganho proporcional

Abra **Projeto LGR** na barra superior. A planta do enunciado está disponível sem precisar cadastrar funções:

- Malha aberta: `G(s,K)=K/[s(s+2)(s+5)]`.
- Malha fechada: `T(s,K)=K/(s^3+7*s^2+10*s+K)`.
- Metas iniciais: estabilidade, sobressinal no máximo 20%, acomodação de 2% estritamente menor que 3 s.

O painel também aceita plantas cadastradas por expressão, coeficientes ou polos/zeros. K deve multiplicar toda a planta; expressões com denominador dependente de K ou ganho não linear são rejeitadas neste fluxo. Os demais analisadores continuam disponíveis.

1. Selecione a planta e ajuste K para ver polos, estabilidade, resposta completa e requisitos.
2. Informe faixa e número de amostras e clique em **Buscar K**. A busca pode ser cancelada.
3. Inspecione o melhor compromisso. Mudar planta, metas ou faixa invalida os resultados anteriores.
4. Compare pelo menos três ganhos; os valores iniciais `1, 6, 80` incluem um caso instável.
5. Baixe os gráficos SVG, a busca CSV e o relatório HTML. Abra o HTML em qualquer navegador para leitura ou impressão em PDF.
6. Use os botões de aplicar para levar um ganho ou a comparação aos gráficos principais sem substituir suas funções cadastradas.

A busca finita não certifica inexistência de solução entre amostras. Métricas de segunda ordem são identificadas como previsões; o atendimento usa a simulação completa. Casos instáveis ou com horizonte insuficiente não recebem acomodação válida.

## Relatório e reprodução

- [Relatório técnico com gráficos e conclusões](docs/relatorio-projeto-lgr.html)
- [Notas do projeto e limitações](docs/projeto-lgr.md)
- [LGR com três ganhos](docs/lgr-comparacao.svg)
- [Respostas ao degrau](docs/degraus-comparacao.svg)
- [Dados da busca](docs/busca-ganhos-lgr.csv)

Para regenerar os arquivos a partir dos mesmos cálculos e testes:

```sh
npm run report:project
```

Os testes do projeto confrontam a exponencial de matriz com uma implementação independente de RK4, verificam as fronteiras K=0 e K=70, casos instáveis, critérios estritos, cancelamento, expressões inválidas e uma especificação relaxada que possui soluções.
