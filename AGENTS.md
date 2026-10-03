# AGENTS.md — Atlas da Apuração

Estas instruções orientam o Codex neste repositório. A fonte funcional/técnica de verdade é `docs/ESPECIFICACAO.md`, revisão 1.1. Nos pontos conflitantes, [ADITIVO_01_COMPARACAO_ZONAS_ATLAS.md](docs/ADITIVO_01_COMPARACAO_ZONAS_ATLAS.md) tem precedência sobre a especificação anterior e as regras de comparação por BU. A versão anterior está preservada em `docs/history/pre-aditivo-01/` apenas para consulta histórica.

## Objetivo

Construir um painel **local, de usuário único**, para a apuração das Eleições Gerais brasileiras de 2026, primeiro turno, cargos Presidente e Governador. Interface cartográfica Brasil → UF → município e três camadas equivalentes: Resultado, Cobertura e Comparação. Resultados EA20 agregados municipais somente de municípios **salvos**; coleta comparativa presidencial EA20 **município–zona com cobertura nacional progressiva**, priorizada pelos favoritos, sem se limitar a eles.

## Regras inegociáveis

1. Sem autenticação, contas, SaaS, Docker obrigatório, deploy, PostgreSQL, Redis ou coleta excessiva. Servidor apenas em `127.0.0.1`.
2. Use React/Vite/TypeScript, MapLibre, ECharts, Node/Fastify e SQLite WAL. Estruturar contratos tipados, migrations e fixtures.
3. TSE é a fonte primária. Descobrir URLs via EA11 e seguir EA12/EA14/EA15/EA20. Comparação histórica usa EA20 município–zona e ZE inteira concluída; EA16→EA18→BU é extensão experimental independente, inativa e fora do caminho crítico do MVP. Validar fase, eleição, turno, cargo, abrangência, identificadores e destinação dos votos.
4. Ambiente `simulated` ou `fixture` **nunca** pode ser apresentado como oficial. Um eventual `f=s` na rota oficial exige falha de validação.
5. Cache condicional ajuda a banda, mas 304 conta como requisição. TSE: limite anunciado de 100 req/s por IP, com risco de bloqueio de 10 min; operar muito abaixo (padrão 2–5 req/s). Não fazer loops de 404.
6. Distinguir `official_aggregate` (EA20 agregado) de `historical_zone_cohort` (zonas concluídas e conciliadas). Nunca substituir Brasil/UF oficial por soma parcial de zonas. Manter metadados, horários e denominadores separados. Receber BU continua sem provar totalização oficial.
7. Snapshots imutáveis, sem interpolação temporal nem preenchimento de lacunas. Replay por última versão capturada até o instante; retificação pode retirar uma unidade da coorte. Recalcular contagens e matrizes, sem acumular eventos cegamente nem usar informação futura.
8. Comparação analítica presidencial:
   - série `bolsonaro`: Jair Bolsonaro 2018; Jair Bolsonaro 2022; Flávio Bolsonaro 2026;
   - série `lula_haddad`: Fernando Haddad 2018; Lula 2022; Lula 2026.
   - Primeiros turnos apenas. Candidatos 2026 somente após resolução dos identificadores oficiais, nunca por fuzzy matching.
9. Usar a mesma coorte completa e `verified` com **ambas** as eleições históricas para seis participações, contagens e duas matrizes. Correspondência exige cadastro estrutural compatível, completo e sem duplicidades, checagem de reorganizações e auditoria; igualdade de UF+ZE isoladamente não basta. `verified` não significa identidade de seções, eleitores ou limites intramunicipais. Mostrar método, cobertura, exclusões e estados `uncertain`, `unmatched`, `review`.
10. Sem diagnósticos, narrativas, previsão, probabilidades de resultado, transferências individuais inferidas, avaliações políticas ou retórica interpretativa.
11. Zero ≠ ausente. Exibir `—`/estado específico quando denominador não definido ou fonte indisponível.
12. Não processar IDs territoriais como inteiros: preservar zeros iniciais.
13. Unidade de coleta: `{eleicao, turno, uf, municipio_tse, zona}`. Brasil/UF contam ZEs distintas `{eleicao, turno, uf, zona}`; município conta **unidades município–zona**, com esse rótulo. ZE só conclui quando todos os segmentos esperados do cadastro oficial estão válidos e concluídos. Não somar contagens municipais de ZE nem colorir geometria municipal como se fosse zonal. Exterior (`ZZ`) só entra na coorte se representável e conciliado, com exclusão/cobertura explícitas caso contrário.
14. Condição conservadora por segmento: `ts > 0 && snt === 0 && st === ts`, com fonte/identificadores/contagens/votos consistentes. Confirmar com EA20 zonal real/simulado; exceções não validadas ficam `needs_review`/`pending_validation`. `and=f` sozinho ou percentual arredondado não prova conclusão.
15. Primeiro colocado por maior votação válida entre **todos** os candidatos, sem exigir maioria absoluta: `bolsonaro`, `lula_haddad`, `outros`, `empate`; dado indefinido não entra na coorte. Soma das quatro classes = tamanho da coorte. Shares usam soma de votos / soma de válidos, nunca média de percentuais zonais.
16. Manter matrizes 4×4 separadas `2018→2026` e `2022→2026`, destacando as duas trocas diretas. Soma das células = coorte; para cada classe, saldo = entradas − saídas; soma dos quatro saldos = 0. Fluxos B→L e L→B **não precisam ser iguais**. Outros/empates não viram trocas bilaterais nem transferências individuais de votos.

## Método de trabalho

- **Primeiro:** ler a especificação, o Aditivo 01 e os contratos de teste vigentes; depois validar fontes reais e fixtures do simulado 2026.
- Trabalhar em etapas pequenas com testes executáveis e documentação do que está pronto.
- Priorizar funcionamento no domingo (04/10/2026): preservar núcleo EA20/EA14, mapa, SQLite, snapshots, watchlist e timeline; avançar na comparação por zonas completas, contagens de liderança e matrizes de transição territorial. BU não é requisito dessa comparação.
- Validar EA20 zonal e cadastro completo de segmentos; importar votação nominal municipal/zonal de 2018/2022 com todos os candidatos necessários para válidos e liderança; conciliar territórios antes de habilitar métricas oficiais. Armazenamento zonal normalizado em migrations, com índices locais; sem JSON único de todo o universo.
- Coleta zonal nacional progressiva usa orçamento global conservador, prioridade de favoritos e varredura periódica das unidades pendentes. EA14/EA15 são pistas, não garantia de sincronização. Remover favorito interrompe apenas coleta agregada municipal e retira prioridade; não interrompe expansão zonal.
- Usar funções puras para métricas, timestamp e coortes, com Vitest e exemplos sintéticos que incluam falhas.
- Não introduzir bibliotecas/infraestrutura novas por preferência pessoal: justificar qualquer desvio da stack.
- Antes de registrar feature pronta: build, typecheck, testes e validação visual devem passar.
- Se fonte/schema não estiver disponível, criar adapter desacoplado e modo fixture; **não inventar** contrato oficial ou dados reais.
- Registrar separadamente evidências sintéticas, simulado TSE e ambiente oficial. Declarar explicitamente se coleta e conciliação nacional por zonas foram validadas no oficial; sucesso com fixtures nunca basta para essa declaração.

## Estado implementado após início das 21h de 02/10/2026

Motor zonal puro e fluxo SQLite/API/UI disponíveis somente em fixture; migrations 002/003 preservam o agregado anterior. Históricos reais estão em banco separado (`data/history/atlas-history.sqlite`) e permanecem `pending_reconciliation`. Prova estrutural de nove ZEs do Acre está em `review`, sem auditoria de reorganizações. Em 03/10, migration 004 adicionou fila/cache persistidos e transporte HTTP validável, ainda sem polling nacional nem ingestão zonal real habilitados. Não habilitar capacidade oficial a partir desses testes. Consulte `docs/VALIDACAO.md` e `docs/OPERACAO.md` antes de continuar.

## Fonte de referência

TSE: https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados

Confira `docs/CONTRATOS_E_TESTES.md` para cenários de verificação e checklists. Atualize a documentação quando uma hipótese técnica for confirmada por arquivos reais.

### Atualização de desempenho — 03/10/2026

Coletor incremental/concorrente e migration 005 implementados; medições locais e amostras HTTP do simulado em `docs/OTIMIZACAO_COLETA_NACIONAL.md`. Lease é por banco; todos os feeds devem compartilhar o mesmo serviço. Painel continua fixture; não habilitar oficial com base no benchmark. Inventário nacional real encontrou 2.580 ZEs de composição igual, ainda review e sem promoção a verified. Auditoria territorial e integração nacional normalizada continuam pendentes.

### Integração de ingestão e consulta do simulado — 03/10/2026

`NationalCollection` prepara o universo nacional e integra EA14/EA15, agregados e ingestão zonal normalizada. `collect:simulated` executa ensaio limitado em banco separado. Três janelas somaram 342 HTTP sem erros, 56 agregados e 22 segmentos do Acre (8 ZEs completas); não é validação zonal nacional. `/simulated` é consulta somente leitura desse acervo, sem coleta automática. Painel principal continua fixture; comparação real/ativação oficial e auditoria territorial continuam pendentes.
