# Otimizações da coleta nacional — 03/10/2026

Este relatório complementa `VALIDACAO_COLETA_NACIONAL.md`, preservado como baseline. A arquitetura, as regras de zona completa e a abrangência nacional permanecem intactas. O ganho medido é do coletor local; **a aplicação continua em fixture e não foi habilitada coleta nacional oficial**.

## Implementação

- `PersistentCollector.save()` grava somente jobs alterados e o estado global, em transação SQLite. Bootstrap grava o cadastro uma vez. Teste com 6.292 jobs registra exatamente **duas atualizações de um único job** por resposta, sem regravar os demais. O orçamento é persistido antes de iniciar HTTP.
- HTTP concorrente configurável (`maxInFlight`, 1–16), sob um único gate de inícios (`intervalMs`, mínimo 200 ms = máximo 5 req/s). Todos os tipos — agregado, tracking, zona, inclusive 304 — consomem o mesmo orçamento. O padrão persistente é 2 em voo / 2 req/s.
- Agregados BR/UF têm precedência entre jobs vencidos e uma vaga exclusiva quando o pool tem mais de uma vaga. Zonas lentas não ocupam essa última vaga. Agregados municipais não recebem essa reserva. A cota física continua única; bloqueio 403/429 pausa também agregados.
- Três classes lógicas, prioridade configurável, favoritos sem reduzir universo, e um turno de cada quatro ordenado pela antiguidade. Seleção percorre uma vez o cadastro, sem ordenar/copiar todos os jobs a cada tick. Mantida O(N) em memória: o benchmark abaixo não justificou adicionar heap/infraestrutura.
- Deduplicação por chave; conflito de URL/tipo rejeitado. Pistas em voo são coalescidas em uma única rechecagem; pistas não furam backoff nem reativam 404. Não há HTTP simultâneo para a mesma unidade.
- Conclusão validada é metadado do adapter HTTP; retificação `complete=false` retorna à política de pendentes. Auditorias completas usam fase determinística por chave distribuída na janela, não uma rodada sincronizada. Pistas posteriores à conclusão também antecipam rechecagem.
- Cache de 200 sem novos validadores remove ETag/Last-Modified antigos. 304 exige corpo previamente validado. Falhas preservam último corpo. 404 suspende; 403/429 impõe pausa global de pelo menos 10 min a partir da resposta, preservada mesmo quando outro HTTP termina depois. Rede/5xx usam backoff exponencial limitado a 10 min e Retry-After quando fornecido.
- Migration 005 adiciona lease SQLite para o loop `run()`, índice de replay e proteção contra alteração/remoção das observações. Lease renovado a cada 5s, expiração 60s, recusa dono concorrente/estado desatualizado. Abort interrompe novos inícios e drena HTTP em voo. Timeout padrão do transporte: 20s. Reserva pré-HTTP impõe recuperação após 30s em caso de crash.
- `captured(key, at)` lê a última resposta aceita até o instante, incluindo retorno a um conteúdo antigo em retificação A→B→A. Observações e corpos permanecem imutáveis. Cache, corpos e observação são gravados juntos; estado de conclusão da fila é gravado na transação seguinte. Crash entre essas transações conserva a observação e pode causar revalidação posterior, sem apagar/reinventar histórico.

O lease coordena **um banco**, não programas ou máquinas diferentes no mesmo IP. Todos os feeds operacionais devem usar o mesmo serviço/banco e `run()`. `tick()` é a primitiva dirigida usada pelos testes. Nenhuma declaração de exclusividade sobre todo o IP é possível só pelo SQLite local.

## Benchmark local comparável

Mesmo cadastro simulado de 6.289 jobs, 300 ciclos, mesmo corpo EA20 capturado e adapter, relógio virtual para retirar espera do rate limiter. Não são requisições reais aceleradas.

| Medida | Baseline | Incremental |
|---|---:|---:|
| Tempo total | 19.603 ms | 1.179 ms |
| Vazão de processamento | 15,30 ciclos/s | 254,36 ciclos/s |
| Mediana por ciclo | 62,02 ms | 3,59 ms |
| p95 | 82,48 ms | 5,56 ms |
| p99 | 108,59 ms | 10,58 ms |
| Observações / corpos deduplicados | 300 / 1 | 300 / 1 |

Ganho aproximado **16,62×** neste ensaio. CPU, caches, aquecimento e interferência do SO afetam as caudas. A janela otimizada de 1,18s é curta: não equivale a soak test, ingestão nacional de votos distintos nem cálculo de coorte nacional. Evidências: [baseline](evidence/national/local-pipeline.json), [otimizado](evidence/national/local-pipeline-optimized.json). O baseline não foi sobrescrito.

## HTTP real controlado — somente simulado

Duas execuções sequenciais, ambas a **2 req/s**, começando por concorrência 2 e depois 3. Cada uma redescobriu EA11/EA12, consultou EA14, cinco EA15, dez segmentos EA20 e BR/AC, depois revalidou as 18 URLs com ETag. URLs derivadas de EA11, fase e contratos validados. O cadastro continuou nacional; a amostra de transporte não é coleta de todo o país.

| Medida | 2 em voo | 3 em voo |
|---|---:|---:|
| Requisições | 38 | 38 |
| 200 / 304 | 20 / 18 | 20 / 18 |
| Erros / bloqueios | 0 | 0 |
| Pico efetivo em voo | 2 | 2 |
| Espaçamento mediano | 517,67 ms | 518,80 ms |
| Latência p50 | 207,45 ms | 140,56 ms |
| Latência p95 | 714,02 ms | 1.038,86 ms |
| Bytes de corpo recebidos | 2.351.833 | 2.351.833 |
| Snapshots agregados normalizados persistidos | 2 | 2 |

Evidências por requisição: [concorrência 2](evidence/national/concurrent-2rps-2inflight.json), [concorrência 3](evidence/national/concurrent-2rps-3inflight.json). O agregado simulado foi persistido independentemente de qualquer match histórico. Não foi necessário elevar req/s; a amostra não demonstrou ganho de uma terceira vaga. Diferenças de latência não permitem atribuir causalidade ao pool. Nenhum teste de saturação/20 req/s ou consulta de resultado oficial foi executado nesta etapa.

## Configuração inicial recomendada

- `intervalMs: 500`, `maxInFlight: 2`; terceira vaga somente se telemetria mostrar espera do pool mantendo o mesmo limite de inícios. Manter teto conservador de implementação 5 req/s, sem promovê-lo a alvo.
- Timeout 20s, máximo 4MiB, um proprietário, sem loops 404. Pausa global 10min ou Retry-After maior.
- Como ponto de partida de planejamento: agregado BR/UF de ambos os cargos a cada 60s; EA14 a cada 30s; EA15 distribuídos a cada 180s; até 20 agregados favoritos a cada 120s. Isso consome aproximadamente **1,29 req/s** (inclui 29 agregados presidenciais, 27 de governador, 28 EA15, EA14 e 20 favoritos).
- Restam aproximadamente **0,71 req/s** para zonas nessa hipótese: passagem de 6.292 segmentos tem piso de **147,5 min**, antes de falhas e retificações. São limites aritméticos, não medições de frescor. As cadências são configuráveis por job (`pollMs`) e precisam de distribuição dos vencimentos no bootstrap.
- Auditoria de todas as 6.292 unidades a cada 10min exigiria 10,49 req/s só para auditoria, incompatível com esse orçamento. **Não adotar os 10min do stress como SLA nacional.** Uma janela inicial de 3h (`auditMs:10800000`) custa aproximadamente 0,58 req/s quando todas estão completas; há pouco espaço restante para retificações. Pendentes podem usar fallback de 15min, mas `due` indica elegibilidade, não garantia de atendimento nessa janela.
- Para frescor nacional de poucos minutos ainda falta medição de carga sustentada e definição de orçamento/cadências. A otimização local removeu um gargalo, não a relação entre número de arquivos e cota HTTP. Atraso comparativo deve ficar explícito; não reduzir universo, estimar parciais ou atrasar deliberadamente BR/UF para esconder a fila.

Esses valores de cadência são uma configuração inicial de operação, **não ativação automática da aplicação**. O construtor mantém compatibilidade com o polling anterior de 60s e auditoria de 600s; quem registra a coleta nacional precisa passar as cadências acima explicitamente. O benchmark utiliza pistas sintéticas de revalidação para encerrar sua amostra limitada.

## Conciliação territorial real nacional

Cruzamento offline do EA12 **oficial 2026**, 6.292 segmentos / 2.641 ZEs, com os imports nacionais reais presidenciais de primeiro turno: 2018, 6.240 segmentos / 81.120 linhas; 2022, 6.283 segmentos / 69.113 linhas. Manifestos, hashes e composição por ZE em [reconciliation.json](evidence/national/reconciliation.json). IDs preservados como strings. Banco histórico lido em modo somente leitura; nenhuma promoção de match.

| Verificação estrutural | Resultado |
|---|---:|
| Mesma chave UF+município+zona nos dois históricos | 6.184 / 6.292 = **98,28%** |
| Segmentos sem chave correspondente em 2018 | 108 |
| Segmentos sem chave correspondente em 2022 | 30 |
| ZEs domésticas com composição municipal inteira igual nos três anos | **2.580 / 2.641 = 97,69%** |
| Segmentos dessas ZEs candidatas à conciliação | **5.940 / 6.292 = 94,41%** |
| Destas ZEs, exigem soma de múltiplos segmentos em cada ano | **1.586** |
| Destas ZEs, um único segmento | 994 |
| Composição diferente (`uncertain`, inclui ZZ) | 52 ZEs |
| Ausência de ZE em pelo menos um histórico (`unmatched`) | 9 ZEs |
| Exterior: exclusão metodológica pendente | 186 segmentos / 1 ZE |
| Correspondência nacional efetivamente `verified` | **0** |

**98,28% é correspondência de chaves, não proporção já conciliada.** Os 2.580 candidatos estruturais permanecem `review`: faltam auditorias de reorganização, inclusive alterações dentro do mesmo município que não mudam sua lista. Os 61 grupos fora desse conjunto somam 352 segmentos (166 domésticos e 186 no exterior). Não confundir contagem de segmentos diretamente coincidentes com elegibilidade da ZE inteira.

Agregações necessárias: nas 1.586 ZEs multissegmento estruturalmente compatíveis, somar votos de todos os candidatos e denominadores de todos os municípios da ZE em cada ano, só após auditoria; não somar contagens municipais de ZEs. Nos grupos alterados, somar antigas zonas ou dividir votos proporcionalmente **não é uma conciliação comprovada**. Precisam de correspondência documental mais granular ou exclusão. Não foram implementados rateios/estimativas nem mudança da unidade analítica.

Exemplo documental de exclusão: a [Resolução TRE-SC 8.063/2023](https://www.tre-sc.jus.br/legislacao/compilada/resolucao/2023/resolucao-n-8-063-de-7-de-novembro-de-2023) regulamenta a instalação da 107ª ZE e recomposição da 24ª. O cruzamento encontra 107ª ausente em 2018/2022 e 24ª com composição diferente. A união das duas zonas atuais não pode ser apresentada como duas ZEs históricas comparáveis. A [página legislativa oficial](https://www.tre-sc.jus.br/legislacao/compilada/resolucao/2023) confirma a ementa; não foi obtido/auditado o anexo territorial integral. Consultas em 03/10/2026.

Outro alerta: AP/0010 mantém a mesma lista de três municípios, mas AP/0014 aparece sem histórico. A [descrição atual do TRE-AP](https://www.tre-ap.jus.br/comunicacao/noticias/2026/Setembro/tre-ap-realiza-carga-e-lacre-das-urnas-eletronicas-da-10a-zona-eleitoral) distingue o Bailique (14ª) do restante rural de Macapá (10ª). Isso impede usar mera igualdade de listas para afirmar identidade territorial; a cadeia de atos de reorganização continua pendente.

## Testes e limites de entrega

57 testes unitários/integração passaram. Cobrem budget/concorrência/reserva de agregados, backoff, pistas, retificação, auditoria, lease, escrita incremental, cache, replay e preservação das invariantes de coorte. Typecheck/build passaram. Evidência E2E/visual registrada em `VALIDACAO.md`.

O loop concorrente e o transporte são executáveis, mas o runtime do painel continua fixture: **não existe nesta entrega ativação oficial nem integração nacional completa de ingestão zonal normalizada e publicação de coortes reais**. A captura/cache e as observações do coletor não substituem esse adapter. Agregados permanecem independentes; sua atualização não depende da conciliação, e falhas comparativas não apagam snapshots aceitos. Isso foi validado em testes e no armazenamento agregado do simulado, não como operação nacional oficial.

Reproduzir: `pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm test:e2e`; `pnpm benchmark:local-national` (offline), `pnpm reconcile:national` (imports locais existentes), `pnpm benchmark:concurrent` (rede opt-in simulado; 38 requests; BENCH_RPS=2 e BENCH_CONCURRENCY=2 por padrão). Não rodar benchmark e coletor em paralelo no mesmo IP. Regras oficiais: [FAQ técnico TSE](https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados), novamente consultado nesta etapa. A ausência de erros nesta amostra não prova capacidade no domingo.
