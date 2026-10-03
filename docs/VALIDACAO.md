# Registro de validação — 02/10/2026

As etapas 0/1 abaixo preservam o registro da primeira implementação. A [revisão do Aditivo 01](#revisão-do-aditivo-01--02102026) registra a migração documental posterior e distingue os novos requisitos zonais das funcionalidades efetivamente verificadas.

## Etapa 0: observação

As respostas originais estão em `packages/fixtures/official` e `packages/fixtures/simulado`. Os manifests `observation*.json` registram URL, captura UTC, HTTP, tamanho e SHA-256 dos bytes. As consultas foram sequenciais, espaçadas em 600 ms, sem retries. O runtime fixture não executa esses scripts nem acessa o TSE.

| Arquivo | Evidência observada |
|---|---|
| EA11 oficial | HTTP 200; f=o; geração 30/09/2026 12:31:44; pleito 3220, ciclo ele2026, eleição 6257/cargo 1 e 6259/cargo 3, turno 1 |
| EA11 simulado | HTTP 200; f=s; pleito 17801, federal 21270, estadual 21272. A data de pleito interna é 26/04/2026; não substituí-la pela data da eleição oficial |
| EA12 simulado | 28 abrangências, 5.755 entradas incluindo exterior. `cd` TSE e `cdi` IBGE são strings; exterior tem `cdi` vazio. DF não vira município fictício |
| EA14 | 29 linhas: 27 UFs, ZZ e BR. Metadados independentes por linha |
| EA15 AC | 23 linhas: 22 municípios com `tpabr=mun` e a própria UF. Diferente do `tpabr=mu` do EA20 municipal |
| EA20 presidente BR | `v.vv=100982116`, `v.vvc=120704576`; soma dos candidatos com `dvt=Válido` coincide com vv. Anulados e sub judice permanecem separados |
| EA20 governador AC / presidente AC / Acrelândia | HTTP 200; fase s, cargos/eleições/abrangências verificáveis nos testes |
| EA16 AC | HTTP 200; cdp=17801; códigos de municípios/zonas/seções preservados. EA18 descoberto por seção principal com da/ha |
| EA18 amostrado | HTTP 200; st=Totalizada, hashes=[{arq:[]}], sem hash. **Nenhum BU disponível nesta amostra; decodificador a validar** |

Referências lidas: [página técnica TSE](https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados), documentos EA11/12/14/15/16/18/20 e instruções de download vinculados nela. EA20 consultado tem revisão 10/07/2026. O campo `dv=n` impede divulgação de votos presidenciais; `pvap` usa votos a votáveis concorrentes, não votos válidos. Schema mínimo aceita campos extras e só normaliza os campos confirmados.

O primeiro teste de EA15 falhou ao assumir apenas linhas municipais. Corrigido com a linha real da própria UF e incluído em regressão. Isso confirma a necessidade de fixtures reais.

## Geometrias

Dois downloads HTTP 200 da [API de malhas do IBGE v3](https://servicodados.ibge.gov.br/api/docs/malhas?versao=3): Brasil com 27 UFs e Acre com 22 municípios, qualidade mínima, coordenadas originais. Assets versionados para navegação offline; `codarea` liga os municípios ao `cdi` EA12. A API não fixa a edição anual nesta URL; hash fixa esta captura. Expansão municipal para outras UFs e edição cartográfica anual explícita permanecem pendentes.

## Limites desta entrega

- Etapa 1 usa uma sequência **sintética e identificada**, separada das capturas brutas do simulado TSE. Ela não representa cronologia de apuração real.
- Coleta oficial, scheduler adaptativo, SSE, ETL histórico e coorte histórica não são declarados operacionais. À época desta etapa, o modelo previsto era BU; ele foi substituído pelo Aditivo 01, conforme registro abaixo.
- CSV 2018/2022: estrutura e importação **a validar**, não inferidas de documentação antiga. Identidades oficiais de candidatos 2026 não resolvidas.
- Observação de um arquivo não prova disponibilidade de todos os territórios nem contrato integral. Falhas de schema devem interromper ingestão, preservando dados locais anteriores.

## Etapa 1: verificação concluída

Ambiente de execução: Windows, Node 24.19.0, pnpm 11.19.0. Verificações em 02/10/2026, horário de Brasília.

| Verificação executada | Resultado |
|---|---|
| Vitest final (`pnpm test`, 15:10) | **20 testes passaram**: 11 contratos/artefatos, 3 métricas/tempo, 6 integração API/SQLite |
| Integridade de originais | SHA-256 e tamanho conferidos para as 13 respostas HTTP 200 versionadas, incluindo as duas malhas |
| Typecheck | `tsc --noEmit` passou; também executado pelo build |
| Build final (`pnpm build`) | Frontend Vite e API tsup compilados; chunks separados para mapa, gráficos e React |
| Formatação | `pnpm format:check` passou; JSON bruto TSE excluído do formatador |
| Playwright (`pnpm test:e2e`) | **1 fluxo completo passou**, Edge headless; sem erros JS e sem solicitações externas |
| Inspeção visual | Screenshots de Brasil, município, cobertura e viewport 390×844 revisados; resize do mapa corrigido e revalidado |
| Execução compilada (`pnpm start`, 15:11) | Fastify informou bind `127.0.0.1:3001`; `/`, `/health`, `/api/v1/latest` e malha BR responderam HTTP 200. Tela compilada aberta e inspecionada no navegador integrado |

O fluxo E2E verifica: clique em polígono; seleção de cargo/território; zero legítimo e participação indefinida; persistência de favorito após reload; município sem passado anterior à inscrição; parada de monitoramento mantendo acervo; replay sem escrita; alternância de métricas/escalas; camadas preservando instante; origem inspecionável; erro da API mantendo último snapshot; ausência de overflow horizontal em tela estreita. Não mede carga de produção, qualidade estatística de coortes ou disponibilidade eleitoral em 04/10.

Evidências visuais: [desktop](evidence/fixture-desktop.png), [município](evidence/fixture-municipality.png), [cobertura](evidence/fixture-coverage.png), [tela estreita](evidence/fixture-mobile.png). Capturas são da fixture, nunca resultados oficiais.

Falhas encontradas e corrigidas durante implementação: linha agregada UF no EA15; import CSS vazio incompatível com o build; coordenada do teste fora do mapa; reenquadramento após resize; fechamento de objeto na alteração do gráfico. A aprovação final refere-se à versão corrigida. Uma execução final foi interrompida por falha de quota da revisão automática; após retomada autorizada, os testes e o servidor executaram normalmente.

## Revisão do Aditivo 01 — 02/10/2026

Documento recebido no repositório como [ADITIVO_01_COMPARACAO_ZONAS_ATLAS.md](ADITIVO_01_COMPARACAO_ZONAS_ATLAS.md), lido integralmente e preservado sem edição. O nome curto mencionado na solicitação não existe; este é o arquivo correspondente usado. Ele prevalece nos conflitos com a v1.0.

**Escopo entregue nesta revisão:** atualização da especificação para 1.1, AGENTS.md, contratos de teste e README; substituição das regras de coorte BU por zonas concluídas/conciliadas; requisitos para contagens de liderança e matrizes 4×4; alinhamento do estado de indisponibilidade na API e na tela. Cópias anteriores dos três documentos principais preservadas em [history/pre-aditivo-01](history/README.md), com SHA-256 conferido antes/depois. Sem alterações de stack, dependências, migrations existentes, fixtures brutas ou acervo local.

O contrato atual de indisponibilidade informa `basis=historical_zone_cohort`, `unitKind=whole_zone` no Brasil/UF e `municipality_zone` no município, `cohort.enabled=false` e `cohort.status=pending_validation`. Governador informa `out_of_scope`. Não publica shares, contagens ou matrizes fictícias para representar fonte ainda desconhecida. O discriminante de origem `ea20|synthetic` dos snapshots anteriores foi preservado; o contrato alvo documenta sua distinção da base metodológica.

| Verificação efetivamente executada | Resultado e alcance |
|---|---|
| `pnpm test` (15:29 BRT) | **21 testes passaram**: 11 TSE, 3 métricas/tempo, 7 API/SQLite. Novo teste verifica estado zonal pendente, unidade por recorte, ausência de métricas fabricadas, escopo de Governador e leitura sem coletar/gravar |
| `pnpm build` | Typecheck (`tsc --noEmit`), Vite e tsup aprovados |
| `pnpm format` + `pnpm format:check` | Código já formatado; verificação aprovada. Originais TSE e arquivos históricos não foram formatados |
| `pnpm test:e2e` | **1 fluxo completo passou** no Edge: mapa, timeline, replay, favoritos, persistência, falhas, layout e novo rótulo zonal pendente; nenhuma chamada externa nem erro JS |
| Inspeção visual | [Comparação pendente desktop](evidence/fixture-comparison-pending.png) e [tela estreita](evidence/fixture-mobile.png) inspecionadas; aviso fixture e limitações visíveis, sem corte no novo texto |
| Conferência documental local | 5 arquivos principais/histórico, 24 links relativos e cercas Markdown verificados; exemplo JSON sintético parseado, shares/denominadores e marginais/saldos das duas matrizes conferidos por script Node pontual |
| Preservação documental | SHA-256 das três cópias históricas idêntico ao original anterior à edição; hashes registrados em `docs/history/README.md` |
| Execução compilada | Servidor reiniciado em `127.0.0.1:3001`, mesmo banco existente. `/health` e `/api/v1/comparison` responderam; comparação retornou base zonal com capacidade desativada e motivo explícito |

Limitações de execução resolvidas: a primeira tentativa de Vitest no sandbox não conseguiu ler a configuração via esbuild; a execução local com permissão ampliada passou. `pnpm exec prettier` não encontrou o executável; os scripts existentes `pnpm format`/`format:check` funcionaram. Não foram necessárias alterações de dependências para resolver essas limitações.

**Coleta e reconciliação nacional por zona no ambiente oficial: NÃO VALIDADAS.** Não houve nova consulta ao TSE nesta revisão. Também não foram implementados nem executados os novos casos de cálculo/coleta de C.A–C.F: continuam pendentes EA20 zonal real/simulado, exceções de conclusão, cadastro completo de segmentos, importação nominal municipal/zonal 2018/2022, identidades oficiais, auditoria de reorganizações, ZZ, migrations zonais, motor de coorte/liderança/transições e capacidade/latência nacional. O teste do exemplo JSON confere apenas a aritmética documental; os 21 testes do projeto e o E2E não comprovam essas funcionalidades.

Próxima prioridade registrada: provas zonais e históricas; funções puras/fixtures de completude, liderança real e matrizes com invariantes; integração SQLite/API/UI e coleta nacional progressiva sob orçamento conservador. As etapas válidas já entregues — fixture, SQLite WAL, mapas, snapshots, watchlist e timeline — permanecem preservadas. BU é extensão experimental independente, sem bloquear comparação por zonas.

## Execução agendada — 02/10/2026, início às 21h BRT

O heartbeat iniciou implementação neste repositório. Estado inicial: branch `main`, commit `da4437979cb2e6b95bfd9266c9b8cb3c20c24ce2`, sem alterações rastreadas; `docs/PLANO_PROXIMAS_ETAPAS.md` era o único arquivo não rastreado. Plano preservado. Não foi criada recorrência adicional.

### Fontes observadas — não confundir com fixture sintética

Seis consultas sequenciais, espaçadas 600 ms, sem retries automáticos, geraram `packages/fixtures/zonal/observation.json` com URL, ambiente, captura UTC, HTTP, bytes, ETag, Last-Modified e SHA-256. Todas retornaram 200 na execução autorizada. A primeira tentativa no sandbox falhou na rede; não houve loop 404.

| Fonte | Evidência efetiva |
|---|---|
| Simulado AC01120/ZE0008 | ts=48, st=48, snt=0, vv=6.447 |
| Simulado AC01511/ZE0008 | ts=71, st=71, snt=0, vv=8.374 |
| Simulado AC01538/ZE0008 | ts=98, st=98, snt=0, vv=11.882 |
| ZE0008 AC | Cadastro EA12 contém os três segmentos; soma 217 seções e 26.703 válidos no simulado. Não se confunde um segmento com a ZE inteira |
| Simulado BA35572/ZE0153 | ts=st=28, snt=0, si=27, sni=1; adapter mantém `needs_review` por exceção não instalada |
| Oficial AC01120/ZE0008, eleição 6257 | f=o, ts=45, st=0, snt=45, votos zero e dvt ausente; `partial`. Não prova conclusão positiva oficial nem destinação futura |
| EA12 oficial | 28 abrangências, 6.292 segmentos, 2.641 chaves UF+ZE; 186 segmentos ZZ. Cadastro observado completo no arquivo, sem validação de coleta de cada segmento |

Contrato confirmado na amostra: EA20 zonal usa `tpabr=zona`, `cdabr` de quatro dígitos. Município é vinculado pela URL completa descoberta via EA11 e pelo cadastro, pois o corpo não o identifica separadamente. Grafia real: `Anulado sub judice`. Adapter valida fase/turno/cargo/eleição/URL/cadastro, contadores e destinos; válidos/annulados/sub judice são conciliados separadamente. Casos não comprovados não são promovidos a completos.

### Históricos reais e conciliação

Dois downloads únicos do CDN TSE: ZIP2018 com 395.389.280 bytes; ZIP2022 com 556.154.774 bytes. Originais ZIP, CSV BR extraídos e manifestos ficam em `data/history`, ignorados no Git. URLs e hashes integrais constam nos manifestos versionados `packages/fixtures/history/{2018,2022}-manifest.json`. Foram extraídos somente `*_BR.csv`, não os arquivos multicargo `*_BRASIL.csv`.

`pnpm inspect:history` validou Windows-1252, separador `;`, aspas, cabeçalhos reais, eleição ordinária, cargo 1 e turno 1, preservando IDs como texto e partições de trânsito. `QT_VOTOS_NOMINAIS_VALIDOS` foi conciliado com nominal/destinação. Todos os registros importados observados tinham destinação Válido. Resultado:

| Ano | Eleição | Linhas de primeiro turno | Segmentos | Candidatos | Soma dos válidos importados |
|---|---|---:|---:|---:|---:|
| 2018 | 295 | 81.120 | 6.240 | 13 | 107.050.749 |
| 2022 | 544 | 69.113 | 6.283 | 11 | 118.229.719 |

As somas são calculadas dos arquivos; não foram conciliadas nesta execução com uma segunda fonte independente. Recortes AC transformados (299/253 linhas, 23 segmentos por ano) e sua transformação/hashes foram versionados. Identidades das séries nos três anos estão em `series-identities.json`; teste compara ID, número e nome exatos com os arquivos capturados, sem fuzzy matching. O mapeamento documental **não habilita** automaticamente o runtime oficial.

`pnpm import:history` inseriu os arquivos integrais em `data/history/atlas-history.sqlite`, em tabelas de importação, segmento, voto e auditoria. Status `pending_reconciliation`. A composição municipal das nove ZEs do Acre coincide em 2018/2022/2026, mas todas permanecem **review**, com relatório versionado. Não foram auditadas reorganizações/limites. Nenhuma dessas unidades reais foi promovida à coorte da aplicação.

### Entrega sintética e persistência

Motor puro implementado: todos os segmentos esperados, mesma coorte nos três anos, liderança entre todos os candidatos, quatro classes, participações ponderadas, quatro deltas, duas matrizes 4×4, saldos e replay por captura. Retificações de resultado ou match retiram unidades. Teste específico 6B/4L, trocas 2 B→L e 1 L→B, termina 5B/5L. Denominador zero/ausente não vira empate. Cadastro futuro não aparece no replay.

Migrations 002/003 acrescentam persistência normalizada e índices; originais e agregado anterior preservados. A fixture tem 3 zonas/6 segmentos, sem pretensão de cadastro real completo. Coorte por captura: **0, 1, 3, 2, 3**; quarta captura retifica uma zona para parcial, quinta recompõe. Brasil/UF contam ZE; município conta município–zona. Leitura/replay não gravam, não consultam rede nem dependem da watchlist. O endpoint declara ambiente fixture, origem metodológica e `officialStatus=pending_validation`.

UI: seis shares, contagens, matrizes selecionáveis, trocas diretas, saldos, tabela filtrável/ordenável com líderes/válidos dos três anos e última captura, timeline em degraus de estados observados. Mapas permanecem neutros na comparação, sem fingir geometria zonal. A tabela larga usa rolagem interna no mobile. Camada de referência territorial final, exportação e cartografia comparativa ainda pendentes.

### Verificações executadas

| Verificação | Resultado |
|---|---|
| Etapa de contratos/motor | 23 testes passaram após corrigir a grafia real `Anulado sub judice` e o caminho local da configuração oficial |
| Integração SQLite/API inicial | 31 testes passaram; novas tabelas, coorte e replay |
| Suíte final `pnpm test`, 21:38 BRT | **41 testes passaram**, 8 arquivos: 3 métricas, 7 motor zonal, 11 contratos TSE anteriores, 3 zonais, 4 históricos/identidades, 3 fila, 2 migrations/históricos, 8 API |
| `pnpm build` | Typecheck, Vite e tsup passaram com UI final e migrations; nenhuma dependência nova |
| `pnpm typecheck` e `pnpm format:check`, fechamento | Passaram |
| `pnpm test:e2e` | **1 fluxo passou**, Edge offline, repetido após tabela ampliada/timeline em degraus; nenhuma solicitação externa nem erro JS |
| Revisão visual | [Desktop](evidence/fixture-comparison-zones.png) e [mobile](evidence/fixture-comparison-mobile.png) inspecionados; fixture explícita, matriz legível, tabela com rolagem interna, sem overflow da página |
| Execução compilada | `pnpm start` em 127.0.0.1:3001; bind conferido no SO, `/health` e `/api/v1/comparison` responderam; banco anterior migrado, fixture pronta e oficial pendente |
| Backup | `pnpm backup` executado antes e depois da migração do banco da aplicação; API SQLite nativa e `integrity_check=ok`, arquivos em `data/backups` |
| Git | `git diff --check` passou; arquivos brutos não formatados, downloads grandes/bancos continuam ignorados |

Limitações de execução: esbuild e rede exigiram execução fora do sandbox; isso não alterou a stack. O teste inicial de justiça da fila cobria só 15 segundos, insuficientes para 9 unidades sem prioridade com um slot de cada quatro; janela corrigida para 20 segundos conforme a política, e todas as unidades foram atendidas. Não foi relaxada a cota global.

### Fila e o que permanece pendente

Componente puro/injetável de fila: orçamento único padrão 2 req/s, cache condicional, 304 consome requisição, backoff, suspensão 404, pausa global 429/403 e justiça entre favoritos e outras unidades. Testado com transporte sintético. **Ainda não integrado a transporte HTTP real, cache/fila persistidos, ingestão zonal real e medições de latência.** Não há coleta nacional em operação.

Estimativa apenas aritmética: 6.292 / 2 = 3.146 s, ou **52min26s** por passagem isolada, sem agregados/latência/falhas. A 5 req/s seriam pelo menos 20min58,4s. Não são medidas operacionais nem promessa de frescor.

**Coleta e conciliação nacional por zonas no ambiente oficial: NÃO VALIDADAS.** Faltam totalização oficial positiva, exceções, auditoria de reorganizações nacional/ZZ, integração real da fila com persistência e observabilidade, métricas de defasagem, e aceite operacional. `TSE_ENV=official/simulated` continua falhando fechado. As provas reais e sintéticas acima não autorizam declarar essa etapa concluída. Próximas ações em `OPERACAO.md`.

## Continuidade — 03/10/2026

Implementadas migration 004 e persistência da fila/cache/observações. O orçamento consumido é gravado antes do HTTP; ETag, próxima tentativa, pausas globais, corpo aceito e suspensão 404 sobrevivem à reconstrução do serviço. Corpos idênticos usam um único artefato comprimido por SHA-256. `304` sem cache é falha, não resultado vazio. Transporte exige origem/fase TSE e callback validador do contrato, rejeita redirects, limita tamanho e usa timeout. Pausa 429/403 começa na conclusão da resposta, sem descontar a latência da pausa.

Validação: **46 testes**, incluindo novos testes de transporte injetado, restauração de cache/cota, 404 e 429 após reinício, 304 órfão, bytes/JSON inválidos e ausência de HTTP sobreposto. Migração v1→v4 e reabertura do arquivo SQLite preservam acervo zonal e cache. `pnpm build` passou, incluindo typecheck. A UI não foi alterada neste incremento; revisão visual/E2E da entrega anterior permanece a referência.

Nenhuma consulta nova ao TSE; evidência deste incremento é sintética/local. O serviço ainda não está ligado a polling nacional e ingestão zonal real. Não existe lease de propriedade entre processos, portanto exige um único proprietário por banco/IP. Bytes registrados não são medição completa de tráfego em falhas. Pendências oficiais e auditoria territorial permanecem inalteradas.

A tentativa de commit da noite anterior não foi executada: a revisão automática de aprovação atingiu limite de uso antes da ação. O código ficou local; esta continuidade retoma também seu registro no remoto.

## Validação técnica de desempenho nacional — 03/10/2026

Relatório: [VALIDACAO_COLETA_NACIONAL.md](VALIDACAO_COLETA_NACIONAL.md). Ferramentas opt-in adicionadas sem alterar arquitetura, stack, escopo nacional ou polling do produto.

- EA12 simulado novamente consultado, hash idêntico à fixture: 6.289 segmentos, 2.639 ZEs, 5.755 entradas município/localidade (5.565 de zona única e 190 de múltiplas); exterior discriminado.
- 56 requisições sequenciais ao simulado com orçamento alvo 2 req/s, teto configurável 20: 20 HTTP200, 36 HTTP304; nenhum 404/429/5xx. ETag e Last-Modified conferidos separadamente. Nenhuma consulta oficial ou teste de saturação.
- Latência zonal 200: p50 652 ms, p95/p99 888 ms (n=10, cauda insuficiente); tamanho médio 9.944 bytes. Percentis/amostras/URLs/hashes em `docs/evidence/national/benchmark.json`.
- Gargalo observado: gravar fila inteira custa média 27,1 ms, duas vezes por HTTP. Pipeline completo local de 300 ciclos, sem rede, levou 19,60s (15,30 ciclos/s), sem comprovar sustentação por horas.
- Modelo local sobre todo o cadastro, com pisos 2/5/10/20 req/s, concentrações, falhas, prioridades, rechecagens e retificações. Hipóteses de concorrência/gravação incremental explicitadas; resultados simulados não aprovam produção nem conciliação.
- Recomendações e alternativas documentadas antes de qualquer mudança estrutural. Coleta e conciliação nacional oficial seguem não validadas.
- Verificação: 49 testes, typecheck/build e format:check passaram. UI/servidor de coleta do produto não foram alterados; E2E visual não repetido. Modelos e relatório têm evidências JSON reproduzíveis, não equivalentes à validação oficial.
