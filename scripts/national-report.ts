import { readFileSync, writeFileSync } from 'node:fs';
const b = JSON.parse(readFileSync('docs/evidence/national/benchmark.json', 'utf8'));
const local = JSON.parse(readFileSync('docs/evidence/national/local-pipeline.json', 'utf8'));
const s = JSON.parse(readFileSync('docs/evidence/national/simulation.json', 'utf8'));
const f = (n: number | null, d = 1) =>
  n === null
    ? '—'
    : n.toLocaleString('pt-BR', { maximumFractionDigits: d, minimumFractionDigits: d });
const table = (header: string[], rows: (string | number)[][]) =>
  `| ${header.join(' | ')} |\n|${header.map(() => '---').join('|')}|\n` +
  rows.map((r) => `| ${r.join(' | ')} |`).join('\n');
const burst = s.results.find((r: any) => r.scenario === 'burst' && r.options.rps === 20),
  noPriority = s.results.find((r: any) => r.scenario === 'no-priority'),
  noHints = s.results.find((r: any) => r.scenario === 'no-hints'),
  sameFallback = s.results.find((r: any) => r.scenario === 'no-hints-same-fallback');
const current = s.results.find((r: any) => r.scenario === 'current'),
  fail = s.results.find((r: any) => r.scenario === 'failures' && r.options.rps === 20);
const meanBytes = b.groups['EA20-zone'].bytes.mean;
const throughput =
  b.requestCount /
  ((Date.parse(b.records.at(-1).startedAt) +
    b.records.at(-1).elapsedMs -
    Date.parse(b.records[0].startedAt)) /
    1000);
const sum = (key: string, exclude: string[]) =>
  b.dimensions
    .filter((r: any) => !exclude.includes(r.uf))
    .reduce((n: number, r: any) => n + r[key], 0);
const text = `# Validação de desempenho da coleta nacional

Data: 03/10/2026. Escopo: validação técnica, sem mudança estrutural do produto. **Abrangência nacional preservada.**

## Conclusão operacional

A topologia nacional é administrável em volume de arquivos, mas **o coletor atual ainda não sustenta a cadência proposta**: HTTP serial e regravação integral da fila são gargalos locais medidos. Aumentar apenas o teto não basta. A estratégia EA15→EA20 é compatível como direcionamento, desde que acrescida de varredura de segurança, auditoria de retificações e reserva para agregados. **Não há aprovação operacional do oficial**, nem medição de capacidade sustentada do TSE no domingo.

Recomenda-se manter a cobertura nacional, otimizar gravações incrementais e concorrência limitada sob um único orçamento global, e então medir novamente. Cenários locais com essas otimizações hipotéticas chegam a atrasos de minutos, não atualização instantânea. Nenhuma otimização estrutural foi aplicada nesta etapa.

## 1. Dimensionamento observado, não estimado

EA12 do **simulado**, eleição 21270, primeiro turno presidencial. SHA-256: '${b.catalogHash}'. Arquivo recém-consultado idêntico à [fixture já versionada](../packages/fixtures/simulado/ea12.json). EA11 foi consultado antes e todas as URLs derivadas de seus diretórios. Capturas completas e banco de benchmark ficam em 'data/national-benchmark/'; [manifesto e medidas por requisição](evidence/national/benchmark.json) são versionados.

${table(
  [
    'Abrangência cadastral',
    'Entradas município/localidade',
    'Uma zona',
    'Múltiplas zonas',
    'Segmentos município–zona',
    'ZEs UF+zona',
  ],
  [
    [
      '27 UFs, incluindo unidade DF',
      sum('entries', ['zz']),
      sum('single', ['zz']),
      sum('multi', ['zz']),
      sum('segments', ['zz']),
      sum('zones', ['zz']),
    ],
    ['Exterior ZZ', 184, 184, 0, 184, 1],
    [
      'Total EA12',
      b.totals.entries,
      b.totals.single,
      b.totals.multi,
      b.totals.segments,
      b.totals.zones,
    ],
  ],
)}

São entradas do cadastro eleitoral, não uma contagem jurídica dos municípios pelo IBGE. DF é uma entrada com 19 zonas e ZZ contém localidades eleitorais no exterior. Excluindo DF e ZZ: ${sum('entries', ['df', 'zz'])} entradas, ${sum('single', ['df', 'zz'])} de zona única e ${sum('multi', ['df', 'zz'])} de múltiplas zonas. **${b.multiMunicipalityZones} ZEs** abrangem mais de uma entrada municipal/localidade (inclui a ZE de ZZ). Logo, contar municípios concluídos não equivale a contar ZEs concluídas.

${table(
  ['UF', 'Entradas', 'Uma zona', 'Múltiplas', 'Segmentos / arquivos EA20', 'ZEs distintas'],
  b.dimensions.map((r: any) => [
    r.uf.toUpperCase(),
    r.entries,
    r.single,
    r.multi,
    r.segments,
    r.zones,
  ]),
)}

Uma leitura completa do indicador requer **${b.totals.segments} arquivos EA20 zonais**. Acrescentam-se 29 agregados presidenciais (BR, 27 UFs e ZZ), EA14 e 28 EA15: 6.347 arquivos por passagem completa desses feeds, mais EA11/EA12 no bootstrap. Governador nas 27 UFs, se consultado a cada minuto, acrescenta 0,45 req/s; **não está incluído na simulação presidencial**. Agregados municipais de favoritos também exigem reserva adicional. Não substituímos o agregado BR/UF pela soma desses arquivos.

Tamanho EA20 zonal médio da amostra: ${f(meanBytes)} bytes; extrapolação de uma passagem sem cache: **${f((meanBytes * b.totals.segments) / 1e6)} MB** de JSON decodificado, sem cabeçalhos/TLS/compressão de rede. É estimativa de volume, não medição de todos os arquivos. O cadastro oficial capturado anteriormente tinha 6.292 segmentos/2.641 ZEs; não foi usado para substituir os números do simulado.

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

${table(
  ['HTTP', 'Ocorrências observadas', 'Percentual'],
  [
    [200, 20, '35,7%'],
    [304, 36, '64,3%'],
    [404, 0, '0%'],
    [429, 0, '0%'],
    ['5xx', 0, '0%'],
  ],
)}

As duas condições de cache retornaram 18/18 respostas 304 cada. Isso comprova comportamento nessa amostra estática, **não prevê a taxa de 304 da apuração**. Não houve alteração de ETag observada durante a janela. Frequências zero de erros não estimam probabilidade futura de falhas.

### Latência HTTP até corpo recebido (ms)

${table(
  ['Tipo / condição', 'n', 'p50', 'p95', 'p99', 'Média bytes em 200'],
  Object.entries(b.groups)
    .filter(([k]) => !['EA11', 'EA12'].includes(k))
    .flatMap(([kind, g]: [string, any]) =>
      [
        ['plain', '200'],
        ['etag', 'ETag'],
        ['modified', 'Last-Modified'],
      ].map(([mode, label]) => [
        kind + ' / ' + label,
        g[mode].n,
        f(g[mode].p50),
        f(g[mode].p95),
        f(g[mode].p99),
        mode === 'plain' ? f(g.bytes.mean) : '0 corpo',
      ]),
    ),
)}

EA11: ${f(b.groups.EA11.plain.mean)} ms / 1.857 bytes; EA12: ${f(b.groups.EA12.plain.mean)} ms / 534.069 bytes. Percentis usam ordem mais próxima (ceil(p×n)); com n=10, **p95 e p99 coincidem com o máximo**. Não são estimativas robustas de cauda. Amostra escolhida por estratos, não aleatória nacional. Conexões reaproveitadas e caches CDN influenciam os resultados.

### Etapas locais e vazão

${table(
  ['Etapa medida', 'n', 'p50 ms', 'p95 ms', 'p99 ms'],
  ['headersMs', 'downloadMs', 'parseMs', 'validationMs', 'persistMs'].map((k) => [
    k,
    b.timing[k].n,
    f(b.timing[k].p50, 3),
    f(b.timing[k].p95, 3),
    f(b.timing[k].p99, 3),
  ]),
)}

'headersMs' inclui conexão/espera de headers; 'downloadMs' mede leitura do corpo após os headers, inclusive zero corpo em 304. Parsing/validação/persistência têm n=20 (apenas 200). Persistência desse benchmark grava bruto comprimido e uma captura em transação SQLite WAL; **não mede importação completa de todas as tabelas de resultados zonais reais**.

Vazão observada da amostra incluindo limitação/esperas: **${f(throughput, 2)} req/s**. Menor espaçamento observado: ${f(Math.min(...b.records.slice(1).map((r: any, i: number) => r.startMs - b.records[i].startMs)), 3)} ms, próximo de 500 ms por precisão do timer; muito abaixo do teto de 20 req/s. Após a observação, o script passou a repetir a espera residual para evitar antecipação submilissegundo. Não se repetiu a rede para medir essa alteração.

Em 200 repetições **offline**, parsing + adapter zonal + hash/gzip + inserção deduplicada tiveram média ${f(b.offlineProcessMs.mean, 3)} ms, p95 ${f(b.offlineProcessMs.p95, 3)} ms. Recíproco: ${f(1000 / b.offlineProcessMs.mean)} operações/s em cache quente; não é vazão sustentada do pipeline nacional.

O método atual 'PersistentCollector.save()', com ${b.totals.segments} jobs, foi medido 20 vezes: média **${f(b.fullQueueSaveMs.mean, 3)} ms**, p95 ${f(b.fullQueueSaveMs.p95, 3)} ms e p99 ${f(b.fullQueueSaveMs.p99, 3)} ms. São **duas gravações integrais por HTTP**. Só essa etapa consome cerca de ${f(2 * b.fullQueueSaveMs.mean)} ms por consulta. Com HTTP zonal serial médio, o limite aritmético aproximado fica em **${f(1000 / (b.groups['EA20-zone'].plain.mean + b.offlineProcessMs.mean + 2 * b.fullQueueSaveMs.mean), 2)} req/s**. Não foi realizado soak test; vazão sustentada em horas continua pendente.

Medição adicional do **pipeline local completo**, sem rede: 300 ciclos com fila nacional, seleção, adapter, duas gravações integrais, cache e observação SQLite em ${f(local.wallMs / 1000, 2)} s. Vazão **${f(local.throughput, 2)} ciclos/s**, tempo por ciclo p50 ${f(local.tickMs.p50)} ms, p95 ${f(local.tickMs.p95)} ms, p99 ${f(local.tickMs.p99)} ms. Um corpo idêntico deduplicado, 300 observações. O relógio do gate avançou virtualmente para medir processamento sem as esperas de rede; não houve envio acelerado ao TSE. Essa janela de aproximadamente 20s confirma limite local abaixo de 20 ciclos/s, mas não certifica sustentação por horas nem ingestão de votos distintos. Evidência: [local-pipeline.json](evidence/national/local-pipeline.json).

## 4. Simulação nacional local

'pnpm simulate:national', modelo determinístico, passos de 50 ms, ${s.units} segmentos, 2 h sintéticas. Arquivo completo: [simulation.json](evidence/national/simulation.json). Nenhuma consulta externa durante a simulação.

Hipóteses: três atualizações parciais antes da conclusão; progressivo conclui entre 10 e 60 min, burst conclui entre 20 e 21 min. EA15 a cada 30s, EA14 a cada 15s, 29 agregados presidenciais a cada 60s: **1,483 req/s só de controle/agregados**, sem Governador e favoritos agregados. No modelo as pistas surgem na cadência nominal, sem esperar sua fila HTTP: limite otimista para detecção quando o controle atrasa. Demandas HTTP de controle continuam consumindo a cota. Todas as requisições usam as latências de EA20 200 medidas; não pressupomos que o percentual de 304 observado se repita. Esse uso é conservador para controles/cache quentes.

Modelo recomendado hipotético: 16 requisições em voo, teto global de inícios 2/5/10/20 req/s, gravação incremental de fila com custo assumido zero (limite otimista), parsing/persistência local de corpo conforme medida. **Concorrência não foi testada no TSE.** Auditorias/fallbacks sincronizados geram picos artificiais de fila; a implementação recomendada deve espalhá-los. Todos os matches são supostos elegíveis para medir propagação potencial da timeline, não para declarar conciliação real.

${table(
  [
    'Cenário',
    'Teto req/s',
    'HTTP totais',
    'Fila máx.',
    'Fila média',
    'Restantes ao fim',
    'Segmentos completos incorporados',
    'P95 pista→banco (s)',
    'P95 conclusão fonte→banco (s)',
  ],
  s.results
    .filter((r: any) => ['progressive', 'burst', 'failures'].includes(r.scenario))
    .map((r: any) => [
      r.scenario,
      r.options.rps,
      r.sent,
      r.maxQueue,
      f(r.meanQueue),
      r.remaining,
      r.completeSegments,
      f(r.detectedToPersistence.p95),
      f(r.completeToPersistence.p95),
    ]),
)}

Quantis de atraso consideram apenas versões **incorporadas**. Os itens ainda na fila ou suspensos não entram no percentil; por isso são mostrados ao lado. Fila restante pode conter auditorias de unidades já completas, não apenas conclusões inéditas. Pista→banco usa o timestamp nominal EA15; valores negativos de capturas antecipadas por fallback viram zero. Não confundir esse número com SLA medido de sincronização TSE.

### Varredura e incorporação da ZE inteira

${table(
  [
    'Teto',
    'Piso ' + b.totals.segments + '/rps, sem outros feeds (s)',
    'Piso após reservar 1,483 req/s (s)',
  ],
  [2, 5, 10, 20].map((rps) => [
    rps,
    f(b.totals.segments / rps),
    f(b.totals.segments / (rps - 89 / 60)),
  ]),
)}

São pisos aritméticos com concorrência suficiente. Com latência serial e duas gravações integrais, uma passagem fria aproximada exige ${f((b.totals.segments * (b.groups['EA20-zone'].plain.mean + b.offlineProcessMs.mean + 2 * b.fullQueueSaveMs.mean)) / 60000)} min, antes de competição com controles. No cenário 'current' (mesmos custos medidos, uma requisição em voo, teto hipotético 20), só ${current.completeSegments}/${b.totals.segments} segmentos foram incorporados em 2 h; fila máxima ${current.maxQueue}, pendentes ${current.remaining}. Não é replay de produção: é projeção dos custos atuais.

${table(
  [
    'Cenário a 20 req/s hipotéticos',
    'ZEs inteiras finais',
    'P50 fonte→timeline ZE (s)',
    'P95',
    'P99',
  ],
  s.results
    .filter(
      (r: any) => r.options.rps === 20 && ['progressive', 'burst', 'failures'].includes(r.scenario),
    )
    .map((r: any) => [
      r.scenario,
      r.wholeZones,
      f(r.wholeZoneTimeline.p50),
      f(r.wholeZoneTimeline.p95),
      f(r.wholeZoneTimeline.p99),
    ]),
)}

ZE só entra quando todos os segmentos esperados têm versões completas disponíveis ao modelo. O instante de observação é conclusão da requisição/processamento; estados anteriores não recebem a unidade retroativamente. Retificação observada retira unidade até nova conclusão. As tabelas não executam conciliação territorial real nem o cálculo completo da coorte histórica na escala nacional.

### Consultas evitadas e prioridade

Baseline ingênua: ${b.totals.segments} × 120 = 754.680 consultas zonais em 2h, mesmo após conclusão. No burst com pistas/fallback/auditoria a 20 req/s foram ${burst.granular}: redução simulada de ${f(100 * (1 - burst.granular / 754680))}%. Isso mede a **política conjunta**, não ganho isolado de EA15.

Comparação menos favorável e mais útil: sem pistas, pendentes a cada 60s e concluídas a cada 600s, foram ${noHints.granular} consultas; política recomendada usa ${noHints.granular - burst.granular} a menos (${f(100 * (1 - burst.granular / noHints.granular))}%). Com o **mesmo fallback de 900s**, remover pistas reduz consultas a ${sameFallback.granular}, mas aumenta p95 de conclusão→banco de ${f(burst.completeToPersistence.p95)}s para ${f(sameFallback.completeToPersistence.p95)}s. Logo EA15 melhora frescor; não reduz necessariamente pedidos se comparado a um polling deliberadamente mais lento.

${table(
  ['Burst / grupo', 'Com prioridade p50/p95 (s)', 'Sem prioridade p50/p95 (s)'],
  ['favorite', 'nonFavorite'].map((k) => [
    k,
    f(burst[k].p50) + ' / ' + f(burst[k].p95),
    f(noPriority[k].p50) + ' / ' + f(noPriority[k].p95),
  ]),
)}

Favoritos sintéticos: primeira entrada cadastral de cada UF doméstica, sem corte no universo. Não representam o limite atual de 20 favoritos da UI; o cenário usa 27 municípios/localidades prioritários como hipótese de carga. Política modelada separa justiça entre controle/granular e entre favoritos/demais. Não é cópia integral do scheduler atual.

### Falhas e retificações simuladas

Injetados: 503 na primeira tentativa de 5% das unidades; 404 na primeira de cada mil (7 unidades), sem repetição; uma pausa global de 600s por 429 após 1.000 consultas granulares; atraso de CDN de 45s em 10% dos segmentos; retificações em 5% (parcial e nova conclusão). Retransmissões sem nova revisão não alteram estado. Não são frequências observadas do TSE.

A 20 req/s hipotéticos: ${fail.errors} falhas, ${fail.suspended} suspensões 404, ${fail.cohortRemovals} retiradas observadas e ${fail.rectifications} versões de retificação incorporadas; ${fail.completeSegments} segmentos/${fail.wholeZones} ZEs completos finais. Algumas versões transitórias podem não ser capturadas; replay preserva o que foi efetivamente observado. A pausa global também atrasou agregados: p95 de espera ${f(fail.aggregateQueueDelay.p95)}s, máximo ${f(fail.aggregateQueueDelay.max)}s. Resultados oficiais devem permanecer independentes e visíveis com sua idade, mesmo quando atrasados.

## 5. Gargalos e alterações necessárias — propostas, não implementadas

${table(
  ['Gargalo', 'Evidência / efeito', 'Alternativa preservando stack e escopo'],
  [
    [
      'HTTP serial',
      'EA20 200 médio 689 ms; teto nominal não gera concorrência',
      'Pool limitado com único gate de inícios, pausa global e cotas por classe; medir 2→5→10 antes de cogitar 20',
    ],
    [
      'Gravação O(universo) duas vezes por consulta',
      'Fila nacional: 27 ms por save; WAL/CPU bloqueiam o event loop',
      'UPSERT só do job alterado + estado global; transação da resposta; preservar cota antes do HTTP',
    ],
    [
      'Seleção ordena a fila inteira',
      'Código atual filtra/ordena Map por tick; custo não isolado neste benchmark',
      'Índice SQLite ou heap local por due/priority, sem Redis; medir antes da alteração',
    ],
    [
      'Pistas municipais sem sincronismo zonal',
      'FAQ TSE e cenário CDN atrasada',
      'Fallback periódico, auditoria de concluídas e coalescência por unidade',
    ],
    [
      'Overhead de controles/agregados',
      '1,483 req/s presidencial nas hipóteses; Governador adiciona 0,45',
      'Cadência adaptativa EA14→EA15, reserva explícita, escalonar polls; não suspender agregados para favorecer coorte',
    ],
    [
      'Propriedade por IP',
      'Lock cobre benchmark, não outros processos/IP compartilhado',
      'Um proprietário com lease/lock robusto; gate comum a todos os feeds',
    ],
    [
      'Auditorias sincronizadas',
      'Picos de ~6,3 mil jobs no modelo',
      'Distribuir due ao longo da janela e dar prioridade por idade',
    ],
    [
      'Custo real da coorte',
      'Modelo não executa conciliação/queries de C(t) nacionais',
      'Benchmark adicional de snapshots normalizados/coorte e índices antes de habilitar',
    ],
  ],
)}

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
`;
writeFileSync('docs/VALIDACAO_COLETA_NACIONAL.md', text);
