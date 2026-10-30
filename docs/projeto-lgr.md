# Projeto de desempenho por LGR

## Modelagem

O projeto usa exclusivamente ganho proporcional e realimentação unitária negativa:

`G(s,K)=K/[s(s+2)(s+5)]`

`T(s,K)=K/[s^3+7s^2+10s+K]`.

A tabela de Routh tem linhas `[1,10]`, `[7,K]`, `[(70-K)/7,0]`, `[K,0]`. A primeira coluna é positiva exatamente para `0<K<70`. K=0 possui polo na origem. Em K=70, `P(s)=(s+7)(s^2+10)`: polos -7 e +/-j sqrt(10). Acima de 70 surgem dois polos no semiplano direito.

## Interpretação do LGR

Os polos de malha aberta estão em 0, -2 e -5. Não há zeros finitos. Os trechos reais para ganho positivo são (-infinito,-5) e (-2,0). As três assíntotas partem do centroide -7/3 com ângulos de 60, 180 e 300 graus. O ponto de saída válido do eixo real é `s=(-7+sqrt(19))/3`, aproximadamente -0,8804.

Aumentar K inicialmente acelera a resposta, mas depois reduz o amortecimento do par complexo dominante. A aproximação ao eixo imaginário aumenta a persistência das oscilações e a acomodação. A frequência de oscilação e a rapidez de acomodação não são a mesma coisa.

## Método de busca e métricas

O exemplo reproduzível testa 1001 ganhos uniformes entre 0 e 100. Refina com até 101 pontos a vizinhança do menor Ts amostrado que respeita Mp. Não usa PI, PD ou PID.

A estabilidade é calculada por Routh. As raízes usam fórmulas de ordens 1/2 e Durand-Kerner com reescala nas demais ordens. O LGR contém 401 ganhos com espaçamento logarítmico e associação por proximidade entre raízes. Nerdamer trata a álgebra simbólica.

A simulação usa realização no espaço de estados, exponencial de matriz por série de Taylor, escala e quadrados sucessivos. No painel do projeto, a malha temporal tem passo de no máximo 0,01 s e horizonte de pelo menos oito constantes de tempo dominantes, limitado a 120 s. O painel não certifica acomodação quando esse limite impede o horizonte necessário. A exponencial de matriz foi confrontada em testes com RK4 independente, passo 0,0005 s.

Mp é o excesso máximo sobre o valor final, em porcentagem. Ts é a primeira amostra após a última saída da faixa de +/-2% do valor final. A incerteza temporal é da ordem de um passo. A aprovação compara valores sem arredondamento: Mp <= limite e Ts < limite. Casos instáveis e de fronteira não recebem métricas de acomodação.

## Resultados reproduzidos

Com os requisitos originais (Mp <= 20%, Ts < 3 s), a busca não encontrou ganho viável. O melhor compromisso amostrado respeitando Mp foi aproximadamente K=6,074, com Mp=1,993% e Ts=3,582 s. Esse resultado é evidência numérica na faixa pesquisada; não é uma prova de inexistência em um contínuo de ganhos.

A acomodação não varia monotonicamente com K. Quando um pico ultrapassa a faixa de 2%, é necessário esperar uma oscilação adicional; isso pode causar saltos no Ts. Portanto, não se deve substituir a última saída da faixa por uma fórmula baseada apenas em polos.

| K | Comportamento | Mp | Ts de 2% |
|---|---|---|---|
| 1 | Estável, lento | 0% | aproximadamente 36,976 s |
| 6,074 | Estável, melhor compromisso amostrado | aproximadamente 1,993% | aproximadamente 3,582 s |
| 80 | Instável | não se aplica | não se aplica |

O tempo de acomodação é o requisito limitante entre os candidatos que respeitam o sobressinal. A relaxação para Ts < 5 s admite soluções; há teste automatizado para evitar que a busca simplesmente responda sempre que não existe solução.

## Previsão pelos polos e simulação

Para um par dominante, o painel informa `Mp≈100 exp(-pi*zeta/sqrt(1-zeta^2))` e `Ts≈-ln(0,02)/sigma`. O gráfico marca `Re(s)=-4/Ts_alvo`. Para a planta de terceira ordem, o terceiro polo e os resíduos alteram a resposta. Essas aproximações explicam tendências, mas não provam atendimento nem inviabilidade das métricas exatas.

## Entrega e demonstração

O relatório HTML inclui modelagem, método, precisão, comparação, LGR, degraus e respostas às seis perguntas do enunciado. Os SVGs podem ser incluídos em slides ou relatórios. O CSV registra todos os ganhos testados. Os gráficos temporais exportados mostram 0 a 12 s; as métricas usam o horizonte adaptativo completo, incluindo os aproximadamente 37 s do caso K=1.

Para demonstrar: abra Projeto LGR, selecione K=10, execute a busca original, inspecione o melhor compromisso, compare 1/6/80, depois altere Ts para 5 s e repita. Explique a diferença entre ausência de solução nas amostras e prova matemática contínua.
