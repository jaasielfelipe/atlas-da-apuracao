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
