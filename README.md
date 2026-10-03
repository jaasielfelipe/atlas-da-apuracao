# Atlas da Apuração

Fluxo local implementado: **fixture offline, SQLite WAL, mapa, timeline e comparação por zonas completas**. Não é uma entrega operacional de coleta oficial. A interface identifica permanentemente os números e horários sintéticos.

**Diretriz vigente:** [Aditivo 01](docs/ADITIVO_01_COMPARACAO_ZONAS_ATLAS.md), integrado à especificação 1.1, prioriza comparação por **zonas completas**, contagens de liderança e matrizes `2018→2026` / `2022→2026`. O motor e a integração SQLite/API/UI funcionam com uma fixture de três zonas e seis segmentos. A fila nacional está implementada como componente testável, ainda sem transporte oficial habilitado. BU é extensão independente.

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
3. Alterne Resultado/Cobertura/Comparação. A última mostra lideranças, seis participações ponderadas, duas matrizes 4×4, saldos, tabela e timeline com dados explicitamente sintéticos. Brasil/UF contam zonas; município conta unidades município–zona. A coorte fixture não substitui o resultado agregado.
4. Arraste a timeline, clique nos pontos, use **Replay/Pausar/Agora**. São observações discretas, sem linhas interpoladas. A escala pode ser horário de captura ou progresso de seções; o indicador pode ser participação ou votos acumulados.
5. Use **Próxima captura sintética** para inserir o próximo evento. A sequência começa com três de cinco capturas. Na quarta, uma retificação retira uma zona da coorte (3→2); na quinta, retorna (2→3). Um município recém-salvo começa seu agregado no evento atual, sem criar passado artificial.
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
| CSV históricos 2018/2022 | Windows-1252, nominal municipal/zonal presidencial do primeiro turno: 6.240 / 6.283 segmentos importados em SQLite separado; 13 / 11 candidatos. Recortes e hashes em `packages/fixtures/history` |
| EA20 município–zona e cadastro | `tpabr=zona`, `cdabr=zona`; município ligado à URL descoberta no EA11. Três segmentos simulados da ZE0008/AC concluídos, 26.703 válidos somados. Cadastro oficial observado: 6.292 segmentos / 2.641 ZEs, incluindo 186 segmentos ZZ |
| Oficial zonal amostrado | AC01120/0008: f=o, ts=45, st=0, snt=45; parcial. Não valida conclusão oficial. BA35572/0153 simulado tem seção não instalada e fica `needs_review` |
| Coleta e conciliação nacional por zona no oficial | **Não validadas**. Nove ZEs do Acre têm mesma composição municipal nos três cadastros, mas seguem `review` até auditoria de reorganizações |
| BU 2026 — extensão independente | **A validar**: EA16 e EA18 consultados; o auxiliar amostrado informa Totalizada, mas não contém hash nem arquivos. Não foi obtido/decodificado BU; isso não condiciona a comparação zonal |

As capturas originais e manifests com URL, HTTP, bytes, captura e SHA-256 estão em `packages/fixtures/`. `zonal/` contém observações simuladas e oficiais separadas no manifesto; `history/` contém recortes reais transformados e auditados. A aplicação usa somente a demonstração fabricada, nunca esses históricos como correspondências verificadas automaticamente.

`pnpm observe:tse` e `node scripts/observe-extra.mjs` são scripts **opt-in de desenvolvimento**, com consultas sequenciais espaçadas, sem retries; substituem as fixtures de observação e exigem revisar os hashes/testes/documentação após uso. Nunca são executados pelo servidor ou pelo replay. Não existe polling de produção nesta versão.

## Estrutura e decisões

- `apps/api`: Fastify, migration SQLite, persistência e produtor local de eventos fixture.
- `apps/web`: React/Vite, MapLibre com GeoJSON local, ECharts e controles acessíveis pelo teclado.
- `packages/domain`: contratos compartilhados, métricas puras e seleção temporal.
- `packages/tse`: schemas Zod mínimos, descoberta EA11, gerador de URL e adapters por tipo.
- `packages/fixtures`: originais TSE, manifests e geometrias IBGE. Não formatar JSON bruto, pois os hashes são dos bytes capturados.
- `docs`: especificação vigente 1.1, aditivo, contratos e registro incremental de evidências; originais anteriores preservados em `docs/history/pre-aditivo-01/`.

Stack obrigatória preservada, sem novas dependências. Snapshots agregados preservam seu formato. Migrations 002/003 acrescentam cadastro/segmentos, versões zonais, votos por candidato, matches e históricos normalizados com índices e imutabilidade. O banco histórico fica em `data/history/atlas-history.sqlite`, isolado da demonstração.

## Próximas etapas ainda pendentes

Prioridade: auditoria de reorganizações nos históricos, resolver exceções de conclusão, validar totalização oficial positiva, acoplar transporte/persistência à fila global e medir atraso nacional. O cadastro observado tem 6.292 segmentos: a 2 req/s, uma varredura isolada já exige ao menos 52min26s, antes dos agregados, latência e falhas. Isso é uma estimativa aritmética, não medição operacional.

Também pendentes: SSE, malhas municipais fora do Acre, exportação analítica e operação oficial. `pnpm backup` cria cópia consistente SQLite via API nativa, incluindo WAL, em `data/backups`. Instruções de históricos e limites em [OPERACAO.md](docs/OPERACAO.md). BU permanece fora do caminho crítico.

Fontes primárias: [documentação técnica TSE](https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados), [EA11 oficial](https://resultados.tse.jus.br/oficial/comum/config/ele-c.json), [malhas IBGE](https://servicodados.ibge.gov.br/api/docs/malhas?versao=3). Especificação funcional: [docs/ESPECIFICACAO.md](docs/ESPECIFICACAO.md).
