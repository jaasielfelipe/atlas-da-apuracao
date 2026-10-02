# Atlas da Apuração

Primeiro fluxo local implementado: **fixture offline, SQLite WAL, mapa e timeline**. Não é uma entrega operacional de coleta oficial. A interface identifica permanentemente os números e horários sintéticos.

**Diretriz vigente:** [Aditivo 01](docs/ADITIVO_01_COMPARACAO_ZONAS_ATLAS.md), integrado à especificação 1.1, prioriza comparação por **zonas completas**, contagens de liderança e matrizes `2018→2026` / `2022→2026`. EA20 município–zona terá cobertura nacional progressiva; favoritos continuam limitando apenas o agregado municipal e priorizam a fila zonal. As funcionalidades zonais ainda estão pendentes; a tela/API informam esse estado. BU é extensão independente, sem bloquear o comparativo.

## Executar

Requisitos: Node.js 22.12+ (validado com 24.19.0), pnpm 11.19.0, navegador com WebGL. Sem credenciais ou serviços externos.

```sh
pnpm install
pnpm dev
```

Abra **http://127.0.0.1:5173**. API em `127.0.0.1:3001`. Ambos vinculam exclusivamente a loopback. Execute os comandos na raiz do projeto. `TSE_ENV` assume `fixture`; valores `official` e `simulated` encerram com erro explicativo enquanto a coleta não estiver implementada.

Para executar a versão compilada:

```sh
pnpm build
pnpm start
```

Abra **http://127.0.0.1:3001**; Fastify serve também os assets compilados. O diretório do projeto deve ser mantido, pois contém migrations, fixtures e malhas locais.

## Experimentar o fluxo

1. Navegue de Brasil para uma UF pelo mapa ou seletor. Presidente e Governador possuem recortes separados; Governador exige UF.
2. Pesquise **Acrelândia**, selecione e clique em **Salvar município**. Seleção e busca sozinhas não produzem snapshots municipais.
3. Alterne Resultado/Cobertura/Comparação. A última informa honestamente que histórico e coorte ainda não estão disponíveis.
4. Arraste a timeline, clique nos pontos, use **Replay/Pausar/Agora**. São observações discretas, sem linhas interpoladas. A escala pode ser horário de captura ou progresso de seções; o indicador pode ser participação ou votos acumulados.
5. Use **Próxima captura sintética** para inserir o próximo evento. A sequência começa com três de cinco capturas. Um município recém-salvo começa no evento atual, sem criar passado artificial.
6. Pare o monitoramento: o acervo continua consultável, mas os próximos eventos deixam de incluir o município.
7. Abra **Origem, horários e denominadores** para inspecionar fonte, bruto, digest e horários separados.

O cenário contém Brasil, 27 UFs e fixtures municipais do Acre. O catálogo permite buscar municípios de outras UFs, mas seus resultados e malhas municipais permanecem indisponíveis nesta etapa. DF não é expandido em municípios; ZZ é preservado no catálogo, fora da cartografia brasileira.

O banco `data/atlas.sqlite` é criado automaticamente e persiste favoritos, snapshots e cursor da demonstração. `ATLAS_DB` permite escolher outro arquivo para uma sessão limpa, sem apagar o acervo existente. Dados brutos são comprimidos com gzip dentro do SQLite, na mesma transação do snapshot. Não editar snapshots: triggers impedem UPDATE/DELETE.

## Verificação

```sh
pnpm test:contracts
pnpm test
pnpm typecheck
pnpm build
pnpm test:e2e
pnpm format:check
```

O teste E2E inicia seus próprios servidores e banco isolado; deixe 5173 e 3001 livres. No Windows utiliza Edge instalado. Em outros sistemas, instale Chromium com `pnpm exec playwright install chromium`; `PLAYWRIGHT_CHANNEL` permite escolher um navegador instalado. Testes unitários/integração usam somente fixtures, sem chamadas ao TSE. O E2E bloqueia e denuncia solicitações externas.

Evidências e limites: [registro de validação](docs/VALIDACAO.md), [contratos e testes](docs/CONTRATOS_E_TESTES.md), [captura desktop](docs/evidence/fixture-desktop.png), [município](docs/evidence/fixture-municipality.png), [cobertura](docs/evidence/fixture-coverage.png), [tela estreita](docs/evidence/fixture-mobile.png).

## Provas de integração TSE — 02/10/2026

| Prova | Resultado efetivamente observado |
|---|---|
| EA11 oficial | HTTP 200, f=o, pleito 3220, ciclo ele2026, Presidente 6257/1, Governador 6259/3, turno 1. Diretórios obtidos de arq[].dir |
| EA14 simulado | HTTP 200; 29 linhas, incluindo BR e ZZ; detector retorna pista baseada em dt/ht, s/e e andamento. Não produz resultado EA20 |
| EA20 simulado | Presidente BR com vv=100.982.116 e vvc=120.704.576. A soma de candidaturas Válido coincide com vv; dvt Anulado/Sub judice preservados e excluídos da participação válida |
| CSV históricos 2018/2022 | **A validar**: nenhum CSV importado nem comparação de colunas/encoding declarada concluída |
| EA20 município–zona e cadastro completo de ZE | **A validar**: a observação anterior de EA20 municipal/UF não comprova o contrato zonal nem exceções de conclusão |
| Coleta e conciliação nacional por zona no oficial | **Não validadas**; não há importação histórica, motor de coorte zonal ou coleta nacional em operação |
| BU 2026 — extensão independente | **A validar**: EA16 e EA18 consultados; o auxiliar amostrado informa Totalizada, mas não contém hash nem arquivos. Não foi obtido/decodificado BU; isso não condiciona a comparação zonal |

As capturas originais e manifests com URL, HTTP, bytes, captura e SHA-256 estão em `packages/fixtures/`. `official/` contém apenas configuração; `simulado/` contém dados reais do ambiente de testes do TSE; `synthetic/` define a demonstração fabricada. A aplicação não usa a sequência sintética como cronologia do simulado nem como votação oficial.

`pnpm observe:tse` e `node scripts/observe-extra.mjs` são scripts **opt-in de desenvolvimento**, com consultas sequenciais espaçadas, sem retries; substituem as fixtures de observação e exigem revisar os hashes/testes/documentação após uso. Nunca são executados pelo servidor ou pelo replay. Não existe polling de produção nesta versão.

## Estrutura e decisões

- `apps/api`: Fastify, migration SQLite, persistência e produtor local de eventos fixture.
- `apps/web`: React/Vite, MapLibre com GeoJSON local, ECharts e controles acessíveis pelo teclado.
- `packages/domain`: contratos compartilhados, métricas puras e seleção temporal.
- `packages/tse`: schemas Zod mínimos, descoberta EA11, gerador de URL e adapters por tipo.
- `packages/fixtures`: originais TSE, manifests e geometrias IBGE. Não formatar JSON bruto, pois os hashes são dos bytes capturados.
- `docs`: especificação vigente 1.1, aditivo, contratos e registro incremental de evidências; originais anteriores preservados em `docs/history/pre-aditivo-01/`.

Stack obrigatória preservada. Nesta primeira tela, CSS local e controles HTML nativos substituem a sugestão Tailwind/shadcn para reduzir dependências; nenhuma infraestrutura alternativa foi introduzida. `tsup` apenas empacota a API TypeScript para execução com Node. Os snapshots guardam payload tipado + metadados indexados; decomposição adicional em tabelas de candidatos fica para a coleta oficial.

## Próximas etapas ainda pendentes

Prioridade comparativa: validar EA20 município–zona/cadastro completo; ETL nominal municipal/zonal 2018/2022 e identidades oficiais; correspondências auditáveis; contagens de ZEs completas, líder real entre todos os candidatos e matrizes 4×4; coleta zonal nacional progressiva, persistência normalizada, shares e replay com reversão por retificação. Brasil/UF contam ZE inteira distinta; município conta segmento rotulado. [Contratos de aceite](docs/CONTRATOS_E_TESTES.md#c-comparação-por-zonas-completas--aceite-obrigatório) ainda não executados para essas funcionalidades.

Também pendentes: coletor oficial com orçamento global/backoff/cache condicional/registro HTTP, SSE, expansão municipal, status/idade dos dados, backup/exportação. BU permanece experimental e fora do caminho crítico. Nenhum desses itens é apresentado como pronto.

Fontes primárias: [documentação técnica TSE](https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados), [EA11 oficial](https://resultados.tse.jus.br/oficial/comum/config/ele-c.json), [malhas IBGE](https://servicodados.ibge.gov.br/api/docs/malhas?versao=3). Especificação funcional: [docs/ESPECIFICACAO.md](docs/ESPECIFICACAO.md).
