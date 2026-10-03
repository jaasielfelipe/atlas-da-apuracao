# Validação de desempenho da coleta nacional

Data: 03/10/2026. Escopo: validação técnica, sem mudança estrutural do produto. **Abrangência nacional preservada.**

## Conclusão operacional

A topologia nacional é administrável em volume de arquivos, mas **o coletor atual ainda não sustenta a cadência proposta**: HTTP serial e regravação integral da fila são gargalos locais medidos. Aumentar apenas o teto não basta. A estratégia EA15→EA20 é compatível como direcionamento, desde que acrescida de varredura de segurança, auditoria de retificações e reserva para agregados. **Não há aprovação operacional do oficial**, nem medição de capacidade sustentada do TSE no domingo.

Recomenda-se manter a cobertura nacional, otimizar gravações incrementais e concorrência limitada sob um único orçamento global, e então medir novamente. Cenários locais com essas otimizações hipotéticas chegam a atrasos de minutos, não atualização instantânea. Nenhuma otimização estrutural foi aplicada nesta etapa.

## 1. Dimensionamento observado, não estimado

EA12 do **simulado**, eleição 21270, primeiro turno presidencial. SHA-256: '616bb78c722c1b0507322225ec8e77f1180039dc9034ab1b8d73fa90672e3ffa'. Arquivo recém-consultado idêntico à [fixture já versionada](../packages/fixtures/simulado/ea12.json). EA11 foi consultado antes e todas as URLs derivadas de seus diretórios. Capturas completas e banco de benchmark ficam em 'data/national-benchmark/'; [manifesto e medidas por requisição](evidence/national/benchmark.json) são versionados.

| Abrangência cadastral | Entradas município/localidade | Uma zona | Múltiplas zonas | Segmentos município–zona | ZEs UF+zona |
|---|---|---|---|---|---|
| 27 UFs, incluindo unidade DF | 5571 | 5381 | 190 | 6105 | 2638 |
| Exterior ZZ | 184 | 184 | 0 | 184 | 1 |
| Total EA12 | 5755 | 5565 | 190 | 6289 | 2639 |

São entradas do cadastro eleitoral, não uma contagem jurídica dos municípios pelo IBGE. DF é uma entrada com 19 zonas e ZZ contém localidades eleitorais no exterior. Excluindo DF e ZZ: 5570 entradas, 5381 de zona única e 189 de múltiplas zonas. **1638 ZEs** abrangem mais de uma entrada municipal/localidade (inclui a ZE de ZZ). Logo, contar municípios concluídos não equivale a contar ZEs concluídas.

| UF | Entradas | Uma zona | Múltiplas | Segmentos / arquivos EA20 | ZEs distintas |
|---|---|---|---|---|---|
| AC | 22 | 21 | 1 | 23 | 9 |
| AL | 102 | 100 | 2 | 107 | 42 |
| AP | 16 | 15 | 1 | 18 | 11 |
| AM | 62 | 61 | 1 | 74 | 60 |
| BA | 417 | 404 | 13 | 450 | 199 |
| CE | 184 | 179 | 5 | 205 | 109 |
| DF | 1 | 0 | 1 | 19 | 19 |
| ES | 78 | 73 | 5 | 85 | 50 |
| ZZ | 184 | 184 | 0 | 184 | 1 |
| GO | 246 | 242 | 4 | 259 | 92 |
| MA | 217 | 215 | 2 | 223 | 105 |
| MT | 142 | 139 | 3 | 147 | 57 |
| MS | 79 | 74 | 5 | 88 | 49 |
| MG | 853 | 836 | 17 | 898 | 304 |
| PR | 399 | 390 | 9 | 421 | 186 |
| PB | 223 | 220 | 3 | 230 | 68 |
| PA | 144 | 138 | 6 | 160 | 101 |
| PE | 185 | 176 | 9 | 208 | 121 |
| PI | 224 | 221 | 3 | 230 | 74 |
| RJ | 92 | 70 | 22 | 183 | 165 |
| RN | 167 | 165 | 2 | 172 | 60 |
| RS | 497 | 482 | 15 | 522 | 165 |
| RO | 52 | 50 | 2 | 56 | 29 |
| RR | 15 | 14 | 1 | 16 | 8 |
| SC | 295 | 281 | 14 | 315 | 100 |
| SE | 75 | 74 | 1 | 77 | 29 |
| SP | 645 | 603 | 42 | 779 | 393 |
| TO | 139 | 138 | 1 | 140 | 33 |

Uma leitura completa do indicador requer **6289 arquivos EA20 zonais**. Acrescentam-se 29 agregados presidenciais (BR, 27 UFs e ZZ), EA14 e 28 EA15: 6.347 arquivos por passagem completa desses feeds, mais EA11/EA12 no bootstrap. Governador nas 27 UFs, se consultado a cada minuto, acrescenta 0,45 req/s; **não está incluído na simulação presidencial**. Agregados municipais de favoritos também exigem reserva adicional. Não substituímos o agregado BR/UF pela soma desses arquivos.

Tamanho EA20 zonal médio da amostra: 9.944,1 bytes; extrapolação de uma passagem sem cache: **62,5 MB** de JSON decodificado, sem cabeçalhos/TLS/compressão de rede. É estimativa de volume, não medição de todos os arquivos. O cadastro oficial capturado anteriormente tinha 6.292 segmentos/2.641 ZEs; não foi usado para substituir os números do simulado.

## 2. Contratos e estratégia recomendada

O [FAQ técnico do TSE](https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados) admite EA14/EA15 como pistas para EA20 e registra possível defasagem de CDN. Também confirma cache condicional, contabilização de 304 na cota, limite publicado de 100 req/s/IP e risco de bloqueio por excesso ou 404. Não há cadência de atualização garantida nem limiar público de tolerância a 404. Consultado em 03/10/2026.

1. Município com uma zona: EA15 agenda a confirmação no **EA20 zonal** quando ts>0, snt=0, st=ts. EA15 e and=f não certificam o resultado nem permitem inventar votos. O EA20 municipal não substitui automaticamente o zonal; municípios não salvos continuam sem coleta agregada municipal.
2. Múltiplas zonas: alteração do município no EA15 gera uma solicitação deduplicada para cada zona pendente daquele município. EA15 não identifica qual zona mudou. Quando todo o município já estava concluído, nova alteração exige rechecagem das zonas concluídas; uma cadência de auditoria cobre alterações silenciosas ou ambíguas.
3. Toda unidade pendente recebe uma revisão periódica mesmo sem nova pista. Se o EA20 ainda reflete a versão anterior, registrar defasagem e reprogramar sob orçamento; não marcar como sincronizado só porque houve 200/304. O cenário usa fallback de 15 min e auditoria de concluídas de 10 min, **hipóteses para avaliação**.
4. Favoritos recebem prioridade, mantendo capacidade mínima para outros territórios. Agregados oficiais possuem sua própria fila lógica, mas compartilham o mesmo limitador físico por IP.
5. Suspender 404, sem loops; 403/429 pausam o orçamento global. Falha/5xx usa backoff. Persistir pausa/cache antes de reiniciar. Não redisparar trabalho já pendente ou em voo.

## 3. Benchmark observado

Execução opt-in: 'pnpm benchmark:national'. 'BENCH_RPS' configurável em (0,20], **padrão e valor medido: 2**. Uma fila sequencial comum atendeu todos os tipos; a aplicação existente está em fixture e não faz coleta externa. Um lock local impede duas instâncias do benchmark. Isso não controla outros programas ou máquinas que compartilhem o mesmo IP; um proprietário global continua requisito operacional. Não foi feito teste de saturação nem consulta ao ambiente oficial.

Amostra: EA11, EA12, EA14, cinco EA15 (AC/BA/MG/SP/AM), dez EA20 zonais (um município de zona única e um de múltiplas por UF), agregado BR e AC. Dezoito URLs foram revalidadas uma vez com ETag e uma vez somente com Last-Modified. Total **56 requisições**, sem retries automáticos. Limite de 20s e 4MiB por arquivo; parada global em 403/429/erro de contrato/rede e após dois 404 distintos, sem repetir a URL ausente.

| HTTP | Ocorrências observadas | Percentual |
|---|---|---|
| 200 | 20 | 35,7% |
| 304 | 36 | 64,3% |
| 404 | 0 | 0% |
| 429 | 0 | 0% |
| 5xx | 0 | 0% |

As duas condições de cache retornaram 18/18 respostas 304 cada. Isso comprova comportamento nessa amostra estática, **não prevê a taxa de 304 da apuração**. Não houve alteração de ETag observada durante a janela. Frequências zero de erros não estimam probabilidade futura de falhas.

### Latência HTTP até corpo recebido (ms)

| Tipo / condição | n | p50 | p95 | p99 | Média bytes em 200 |
|---|---|---|---|---|---|
| EA14 / 200 | 1 | 33,7 | 33,7 | 33,7 | 29.413,0 |
| EA14 / ETag | 1 | 52,5 | 52,5 | 52,5 | 0 corpo |
| EA14 / Last-Modified | 1 | 39,7 | 39,7 | 39,7 | 0 corpo |
| EA15 / 200 | 5 | 391,7 | 887,9 | 887,9 | 333.394,6 |
| EA15 / ETag | 5 | 55,8 | 59,6 | 59,6 | 0 corpo |
| EA15 / Last-Modified | 5 | 42,5 | 53,9 | 53,9 | 0 corpo |
| EA20-zone / 200 | 10 | 652,0 | 888,0 | 888,0 | 9.944,1 |
| EA20-zone / ETag | 10 | 36,1 | 60,9 | 60,9 | 0 corpo |
| EA20-zone / Last-Modified | 10 | 33,0 | 60,0 | 60,0 | 0 corpo |
| EA20-aggregate / 200 | 2 | 45,6 | 65,6 | 65,6 | 10.040,0 |
| EA20-aggregate / ETag | 2 | 25,5 | 32,0 | 32,0 | 0 corpo |
| EA20-aggregate / Last-Modified | 2 | 35,6 | 51,5 | 51,5 | 0 corpo |

EA11: 305,9 ms / 1.857 bytes; EA12: 532,6 ms / 534.069 bytes. Percentis usam ordem mais próxima (ceil(p×n)); com n=10, **p95 e p99 coincidem com o máximo**. Não são estimativas robustas de cauda. Amostra escolhida por estratos, não aleatória nacional. Conexões reaproveitadas e caches CDN influenciam os resultados.

### Etapas locais e vazão

| Etapa medida | n | p50 ms | p95 ms | p99 ms |
|---|---|---|---|---|
| headersMs | 56 | 51,484 | 799,127 | 887,420 |
| downloadMs | 56 | 0,034 | 7,016 | 11,169 |
| parseMs | 20 | 0,244 | 6,032 | 7,969 |
| validationMs | 20 | 2,342 | 68,445 | 79,433 |
| persistMs | 20 | 0,696 | 10,945 | 12,914 |

'headersMs' inclui conexão/espera de headers; 'downloadMs' mede leitura do corpo após os headers, inclusive zero corpo em 304. Parsing/validação/persistência têm n=20 (apenas 200). Persistência desse benchmark grava bruto comprimido e uma captura em transação SQLite WAL; **não mede importação completa de todas as tabelas de resultados zonais reais**.

Vazão observada da amostra incluindo limitação/esperas: **1,83 req/s**. Menor espaçamento observado: 499,795 ms, próximo de 500 ms por precisão do timer; muito abaixo do teto de 20 req/s. Após a observação, o script passou a repetir a espera residual para evitar antecipação submilissegundo. Não se repetiu a rede para medir essa alteração.

Em 200 repetições **offline**, parsing + adapter zonal + hash/gzip + inserção deduplicada tiveram média 1,189 ms, p95 1,862 ms. Recíproco: 841,0 operações/s em cache quente; não é vazão sustentada do pipeline nacional.

O método atual 'PersistentCollector.save()', com 6289 jobs, foi medido 20 vezes: média **27,091 ms**, p95 30,153 ms e p99 34,860 ms. São **duas gravações integrais por HTTP**. Só essa etapa consome cerca de 54,2 ms por consulta. Com HTTP zonal serial médio, o limite aritmético aproximado fica em **1,34 req/s**. Não foi realizado soak test; vazão sustentada em horas continua pendente.

Medição adicional do **pipeline local completo**, sem rede: 300 ciclos com fila nacional, seleção, adapter, duas gravações integrais, cache e observação SQLite em 19,60 s. Vazão **15,30 ciclos/s**, tempo por ciclo p50 62,0 ms, p95 82,5 ms, p99 108,6 ms. Um corpo idêntico deduplicado, 300 observações. O relógio do gate avançou virtualmente para medir processamento sem as esperas de rede; não houve envio acelerado ao TSE. Essa janela de aproximadamente 20s confirma limite local abaixo de 20 ciclos/s, mas não certifica sustentação por horas nem ingestão de votos distintos. Evidência: [local-pipeline.json](evidence/national/local-pipeline.json).

## 4. Simulação nacional local

'pnpm simulate:national', modelo determinístico, passos de 50 ms, 6289 segmentos, 2 h sintéticas. Arquivo completo: [simulation.json](evidence/national/simulation.json). Nenhuma consulta externa durante a simulação.

Hipóteses: três atualizações parciais antes da conclusão; progressivo conclui entre 10 e 60 min, burst conclui entre 20 e 21 min. EA15 a cada 30s, EA14 a cada 15s, 29 agregados presidenciais a cada 60s: **1,483 req/s só de controle/agregados**, sem Governador e favoritos agregados. No modelo as pistas surgem na cadência nominal, sem esperar sua fila HTTP: limite otimista para detecção quando o controle atrasa. Demandas HTTP de controle continuam consumindo a cota. Todas as requisições usam as latências de EA20 200 medidas; não pressupomos que o percentual de 304 observado se repita. Esse uso é conservador para controles/cache quentes.

Modelo recomendado hipotético: 16 requisições em voo, teto global de inícios 2/5/10/20 req/s, gravação incremental de fila com custo assumido zero (limite otimista), parsing/persistência local de corpo conforme medida. **Concorrência não foi testada no TSE.** Auditorias/fallbacks sincronizados geram picos artificiais de fila; a implementação recomendada deve espalhá-los. Todos os matches são supostos elegíveis para medir propagação potencial da timeline, não para declarar conciliação real.

| Cenário | Teto req/s | HTTP totais | Fila máx. | Fila média | Restantes ao fim | Segmentos completos incorporados | P95 pista→banco (s) | P95 conclusão fonte→banco (s) |
|---|---|---|---|---|---|---|---|---|
| progressive | 2 | 14310 | 6291 | 5.405,8 | 5979 | 2521 | 4.977,2 | 5.035,2 |
| burst | 2 | 14013 | 6291 | 5.385,3 | 5979 | 2677 | 5.661,9 | 5.682,9 |
| failures | 2 | 12813 | 7181 | 5.908,5 | 6823 | 2177 | 5.723,9 | 5.758,8 |
| progressive | 5 | 35348 | 6289 | 4.580,3 | 4179 | 6289 | 1.550,5 | 1.585,2 |
| burst | 5 | 33363 | 6289 | 4.630,9 | 4179 | 6289 | 1.700,2 | 1.730,5 |
| failures | 5 | 30361 | 7180 | 4.821,2 | 4172 | 6282 | 2.428,3 | 2.448,2 |
| progressive | 10 | 68381 | 6286 | 3.162,0 | 1179 | 6289 | 529,3 | 584,3 |
| burst | 10 | 65306 | 6292 | 3.346,0 | 1179 | 6289 | 663,1 | 697,8 |
| failures | 10 | 59327 | 7179 | 3.621,4 | 1172 | 6282 | 1.091,7 | 1.105,4 |
| progressive | 20 | 85791 | 6292 | 1.404,0 | 0 | 6289 | 176,7 | 220,5 |
| burst | 20 | 80987 | 6292 | 1.648,1 | 0 | 6289 | 285,2 | 317,5 |
| failures | 20 | 74567 | 7181 | 2.033,2 | 0 | 6282 | 586,6 | 589,3 |

Quantis de atraso consideram apenas versões **incorporadas**. Os itens ainda na fila ou suspensos não entram no percentil; por isso são mostrados ao lado. Fila restante pode conter auditorias de unidades já completas, não apenas conclusões inéditas. Pista→banco usa o timestamp nominal EA15; valores negativos de capturas antecipadas por fallback viram zero. Não confundir esse número com SLA medido de sincronização TSE.

### Varredura e incorporação da ZE inteira

| Teto | Piso 6289/rps, sem outros feeds (s) | Piso após reservar 1,483 req/s (s) |
|---|---|---|
| 2 | 3.144,5 | 12.172,3 |
| 5 | 1.257,8 | 1.788,3 |
| 10 | 628,9 | 738,4 |
| 20 | 314,5 | 339,6 |

São pisos aritméticos com concorrência suficiente. Com latência serial e duas gravações integrais, uma passagem fria aproximada exige 78,0 min, antes de competição com controles. No cenário 'current' (mesmos custos medidos, uma requisição em voo, teto hipotético 20), só 1531/6289 segmentos foram incorporados em 2 h; fila máxima 9521, pendentes 9518. Não é replay de produção: é projeção dos custos atuais.

| Cenário a 20 req/s hipotéticos | ZEs inteiras finais | P50 fonte→timeline ZE (s) | P95 | P99 |
|---|---|---|---|---|
| progressive | 2639 | 28,0 | 238,2 | 280,4 |
| burst | 2639 | 213,8 | 322,0 | 334,0 |
| failures | 2632 | 432,4 | 824,3 | 846,1 |

ZE só entra quando todos os segmentos esperados têm versões completas disponíveis ao modelo. O instante de observação é conclusão da requisição/processamento; estados anteriores não recebem a unidade retroativamente. Retificação observada retira unidade até nova conclusão. As tabelas não executam conciliação territorial real nem o cálculo completo da coorte histórica na escala nacional.

### Consultas evitadas e prioridade

Baseline ingênua: 6289 × 120 = 754.680 consultas zonais em 2h, mesmo após conclusão. No burst com pistas/fallback/auditoria a 20 req/s foram 70307: redução simulada de 90,7%. Isso mede a **política conjunta**, não ganho isolado de EA15.

Comparação menos favorável e mais útil: sem pistas, pendentes a cada 60s e concluídas a cada 600s, foram 85658 consultas; política recomendada usa 15351 a menos (17,9%). Com o **mesmo fallback de 900s**, remover pistas reduz consultas a 69179, mas aumenta p95 de conclusão→banco de 317,5s para 877,7s. Logo EA15 melhora frescor; não reduz necessariamente pedidos se comparado a um polling deliberadamente mais lento.

| Burst / grupo | Com prioridade p50/p95 (s) | Sem prioridade p50/p95 (s) |
|---|---|---|
| favorite | 1,7 / 123,0 | 23,5 / 231,3 |
| nonFavorite | 95,0 / 285,5 | 95,0 / 286,8 |

Favoritos sintéticos: primeira entrada cadastral de cada UF doméstica, sem corte no universo. Não representam o limite atual de 20 favoritos da UI; o cenário usa 27 municípios/localidades prioritários como hipótese de carga. Política modelada separa justiça entre controle/granular e entre favoritos/demais. Não é cópia integral do scheduler atual.

### Falhas e retificações simuladas

Injetados: 503 na primeira tentativa de 5% das unidades; 404 na primeira de cada mil (7 unidades), sem repetição; uma pausa global de 600s por 429 após 1.000 consultas granulares; atraso de CDN de 45s em 10% dos segmentos; retificações em 5% (parcial e nova conclusão). Retransmissões sem nova revisão não alteram estado. Não são frequências observadas do TSE.

A 20 req/s hipotéticos: 316 falhas, 7 suspensões 404, 204 retiradas observadas e 512 versões de retificação incorporadas; 6282 segmentos/2632 ZEs completos finais. Algumas versões transitórias podem não ser capturadas; replay preserva o que foi efetivamente observado. A pausa global também atrasou agregados: p95 de espera 275,7s, máximo 600,1s. Resultados oficiais devem permanecer independentes e visíveis com sua idade, mesmo quando atrasados.

## 5. Gargalos e alterações necessárias — propostas, não implementadas

| Gargalo | Evidência / efeito | Alternativa preservando stack e escopo |
|---|---|---|
| HTTP serial | EA20 200 médio 689 ms; teto nominal não gera concorrência | Pool limitado com único gate de inícios, pausa global e cotas por classe; medir 2→5→10 antes de cogitar 20 |
| Gravação O(universo) duas vezes por consulta | Fila nacional: 27 ms por save; WAL/CPU bloqueiam o event loop | UPSERT só do job alterado + estado global; transação da resposta; preservar cota antes do HTTP |
| Seleção ordena a fila inteira | Código atual filtra/ordena Map por tick; custo não isolado neste benchmark | Índice SQLite ou heap local por due/priority, sem Redis; medir antes da alteração |
| Pistas municipais sem sincronismo zonal | FAQ TSE e cenário CDN atrasada | Fallback periódico, auditoria de concluídas e coalescência por unidade |
| Overhead de controles/agregados | 1,483 req/s presidencial nas hipóteses; Governador adiciona 0,45 | Cadência adaptativa EA14→EA15, reserva explícita, escalonar polls; não suspender agregados para favorecer coorte |
| Propriedade por IP | Lock cobre benchmark, não outros processos/IP compartilhado | Um proprietário com lease/lock robusto; gate comum a todos os feeds |
| Auditorias sincronizadas | Picos de ~6,3 mil jobs no modelo | Distribuir due ao longo da janela e dar prioridade por idade |
| Custo real da coorte | Modelo não executa conciliação/queries de C(t) nacionais | Benchmark adicional de snapshots normalizados/coorte e índices antes de habilitar |

## 6. Parâmetros recomendados

- **20 req/s/IP como teto configurável do experimento**, não meta nem declaração de segurança operacional. Valor inicial de medição permanece 2; elevar somente com margem demonstrada, transporte concorrente e dono global. O coletor do produto mantém o limite anterior de 5 req/s e não foi reconfigurado nesta tarefa.
- Timeout 20s; corpo máximo 4MiB; nenhuma repetição automática de 404; 429/403 pausa de pelo menos 10min a partir da resposta, respeitando Retry-After maior. Backoff para rede/5xx.
- ETag preferido, Last-Modified como fallback; guardar validador apenas após aceitar corpo/contexto. 304 economiza bytes, nunca a cota.
- Avaliar EA14 15–30s, EA15 30–60s escalonado e agregados 30–60s conforme orçamento total, incluindo Governador e favoritos. Os valores mais rápidos não cabem automaticamente no padrão 2 req/s.
- Auditoria de concluídas 10min e fallback de pendentes 15min foram parâmetros de stress local. Definir o atraso tolerável do produto antes de adotá-los; reduzir a janela aumenta consumo. Priorizar conclusão recente sem impedir varredura nacional.
- Antes de habilitar: teste prolongado local, concorrência real pequena no simulado, ingestão normalizada e medição de coorte. Não subir a 20 apenas porque a simulação terminou a fila.

## 7. Limitações e integridade

Amostra pequena, estática, fora da apuração; não mede carga real de domingo, distribuição de retificações, bloqueios, cauda de latência nacional nem sustentação de 20 req/s. Corpo decodificado não equivale a bytes no fio. SQLite local aquecido e microbenchmark deduplicado subestimam ingestão completa. Modelo de futuros cadastros, malhas e auditoria territorial não foi incluído. Intermediários não observados não podem ser recuperados por interpolação.

**Agregado oficial continua seu próprio EA20**. Comparação usa apenas segmentos completos e correspondência verificada nos dois históricos; Brasil/UF exigem ZE inteira, não soma de contagens municipais. ZZ consta do dimensionamento, mas sua participação na coorte depende de conciliação/representação válidas. Nenhum match real foi promovido por este benchmark. **Coleta e conciliação nacional oficial seguem não validadas.**

## 8. Reprodução e aceite desta validação

1. 'pnpm benchmark:national': rede opt-in somente simulado, padrão 2 req/s, 56 requisições nesta topologia. Não executar simultaneamente com outro coletor que compartilhe IP.
2. 'pnpm simulate:national': offline; usa cadastro capturado cujo hash é idêntico à fixture versionada e latências do manifesto.
3. 'pnpm benchmark:local-national': 300 ciclos locais; usa um corpo capturado em data/national-benchmark. 'pnpm report:national' regenera este relatório dos JSON versionados, sem rede.
4. 'pnpm test', 'pnpm typecheck', 'pnpm build', 'pnpm format:check'.

Entregues ferramentas de validação e relatório; nenhuma mudança de grande porte na arquitetura, nenhuma remoção de funcionalidade e nenhuma restrição da comparação a favoritos. As alterações recomendadas acima precisam de implementação e nova validação próprias.

Verificação desta entrega: **49 testes passaram**, incluindo três do modelo nacional (quantis, orçamento/completude/replay, falhas/retificação). Typecheck, build e formatação passaram. Nenhuma alteração de UI: os hashes dos assets compilados permaneceram iguais; não foi repetido E2E visual nesta etapa de ferramentas offline.
