# Contratos, provas de integração e testes — Atlas da Apuração

**Revisão 1.1 — 02/10/2026.** Leia [ESPECIFICACAO.md](ESPECIFICACAO.md) e [Aditivo 01](ADITIVO_01_COMPARACAO_ZONAS_ATLAS.md), que prevalece nos conflitos. Este arquivo fornece uma agenda operacional testável; não substitui documentos EA nem comprova implementação. A [revisão anterior](history/pre-aditivo-01/CONTRATOS_E_TESTES.md) foi preservada integralmente.

**Mudança de aceite:** o MVP comparativo exige EA20 município–zona, ZE inteira concluída, contagens de liderança e matrizes de transição. EA16/EA18/BU não condicionam sua entrega. Os testes zonais abaixo são **contratos obrigatórios a implementar/executar**, salvo evidência explicitamente registrada em [VALIDACAO.md](VALIDACAO.md). A aprovação dos testes anteriores não valida automaticamente estes casos.

## A. Testes de adaptadores TSE

| Teste | Entrada | Resultado esperado |
|---|---|---|
| EA11 real | `https://resultados.tse.jus.br/oficial/comum/config/ele-c.json` | Encontra pleito 3220, ciclo `ele2026`, federal 6257 (Presidente código 1), estadual 6259 (Governador 3), sem misturar 2024/eleições suplementares |
| EA11 diretórios | `arq[].tp`, `arq[].dir` | Gerador de URLs deriva diretórios e aplica padding sem concatenar tokens incorretos |
| EA20 simulado federal | URL de simulado BR/Presidente indicada no TSE | Lê `f=s`, `tpabr=br`, `carg[].cd=1`; nunca registra resultado oficial |
| EA20 simulado estadual | URL de simulado AC/Governador indicada no TSE | Lê `f=s`, `tpabr=uf`, `carg[].cd=3`; não confunde eleição 21272 com a federal 21270 |
| EA14 simulado | `br-e021270-ab.json` | Lê `abr[]` de UFs, índices/seções/eleitorado; não assume atualização atômica do EA20 |
| EA12 simulado | `mun-e021270-cm.json` | Constrói mapa código TSE para IBGE conforme campos reais e valida univocidade |
| Fase inválida | EA20 `f=s` para conexão em modo `official` | Rejeita a importação com erro explicativo |
| Sem arquivo ainda | HTTP 404 em URL teórica ainda não publicada | Suspende retry rápido, não multiplica 404 |
| Sem alteração | HTTP 304 | Não cria snapshot; contabiliza request no orçamento interno |
| IDG alterado sem ordenação | IDs arbitrários em feeds distintos | Não interpreta maior IDG como publicação mais recente global |
| Situação jurídica | Simulado com `dvt="Anulado"`, `"Anulado sub judice"` | Mantém estado, separa voto computado de voto válido; não converte ilegalmente o numerador |
| Zero votos | EA20 válido com dados zerados | Mantém contagem zero, `share=null` quando denominador zero |
| Correção/revisão | EA20 com mesmo território e total de votos inferior ao anterior | Salva nova versão sem apagar anterior; registra anomalia se cabível |
| String de 5 dígitos | município `00035` | URL e banco preservam os zeros |
| EA20 município–zona | JSON real/simulado e URL derivados de configuração/documentação | Confirmar abrangência, UF/município/zona, eleição/turno/cargo/fase, `ts/st/snt`, votos e denominadores; prova ainda pendente |
| Cadastro de segmentos | Cadastro completo 2026 por UF/ZE | Lista todos os municípios constituintes; ausência/incompletude impede declarar ZE concluída |

## B. Testes do banco

- Snapshots são imutáveis e deduplicados por digest + território + eleição + fase.
- Dois arquivos de abrangências diferentes não se sobrescrevem, ainda que tenham horários próximos.
- Guardar UTC de captura, fonte `dg/hg` e totalização `dt/ht` separadamente.
- Desligar/religar o app mantém watchlist e snapshots e não replica eventos já persistidos.
- `simulated` e `official` nunca têm consultas que se misturem por padrão.
- `fixture` também é isolado. `basis=historical_zone_cohort` nunca transforma ambiente sintético em oficial.
- **Contrato zonal novo:** migrations normalizadas para cadastro/segmentos, votos de todos os candidatos, históricos, correspondências, membros, métricas e transições; PKs e índices por ambiente, eleição/ano, turno, UF, município, zona, candidatura e captura.
- Correção cria nova versão; replay anterior preserva a versão anterior. Match/cadastro/histórico/identidade conhecidos depois do corte não reescrevem snapshots comparativos antigos.
- Unicidade impede reuso de unidade histórica em duas ZEs da mesma coorte/ano e duplicação de ZE que cruza municípios. Agregados incrementais devem coincidir com recomputação integral.
- Migration zonal deve preservar banco do primeiro fluxo: snapshots, bruto, watchlist e cursor. Não guardar o universo inteiro num único JSON.

## C. Comparação por zonas completas — aceite obrigatório

Substitui o antigo teste de coorte BU conforme **§8 A–F do Aditivo 01**. Status inicial de todos os casos C: **pendente de implementação/prova**. Registrar para cada caso executado: comando, arquivo de teste, ambiente, fixture/digest, resultado e limitação. Usar funções puras e Vitest para métricas/tempo/coorte; integração SQLite/API e navegador para persistência e apresentação.

### C.A Fonte, conclusão e identidade

| ID | Entrada/cenário | Resultado esperado |
|---|---|---|
| ZA01 | EA20 zonal efetivamente capturado do oficial ou simulado | URL, `tpabr/cdabr`, UF/município/zona, cargo, eleição, turno e fase demonstrados pelo arquivo/documentação; SHA-256 e captura registrados |
| ZA02 | `f=s` em rota oficial; cargo, turno, eleição ou território diferentes do pedido | Adaptador rejeita antes de persistir; simulado continua simulado, fixture continua fixture |
| ZA03 | `ts>0`, `st=ts`, `snt=0`, votos/identificadores consistentes | Segmento completo pela regra conservadora, sujeita a validação da fonte |
| ZA04 | `ts=0`, parcial 99,99% arredondado, `and=f` com contadores parciais | Não concluir por arredondamento ou sinal isolado; estado parcial/revisão com motivo |
| ZA05 | Seção não instalada/anulada, contadores incoerentes ou exceção jurídica sem regra confirmada | `needs_review`; não forçar totalização nem fabricar denominador |
| ZA06 | `vv≠vvc`, candidato Anulado/Sub judice, `dv=n`, candidato faltante | Respeita destinação e indisponibilidade; não confunde `vap/pvap` com votos válidos nem omite candidatos da liderança |
| ZA07 | Série sem identificador oficial confirmado em qualquer ano | `candidate_unresolved`, fora da coorte; nunca resolver por nome/fuzzy matching |
| ZA08 | IDs com zeros, zona igual em UFs diferentes, eleição/ambiente distintos | Identificadores strings e isolamento; nenhuma colisão |

### C.B ZE inteira, segmentos e conciliação

| ID | Entrada/cenário | Resultado esperado |
|---|---|---|
| ZB01 | Fixture ZE `0005`/UF `AA`, com `00001/0005` completo e `00002/0005` a 70% | ZE incompleta Brasil/UF; M1 pode contar uma unidade **município–zona** se conciliada, sem declarar ZE completa |
| ZB02 | Segundo segmento passa a 100% | Uma única ZE completa Brasil/UF; votos/denominadores somados, sem média de percentuais |
| ZB03 | Segmento desconhecido/ausente ou cadastro não comprovadamente completo | ZE não conclui; cobertura/validação pendente, sem `every([])` tornar zona elegível |
| ZB04 | Agregar resultados de dois municípios da mesma ZE; mesmo número de ZE em outra UF | Deduplicar ZE pela chave da eleição/turno/UF/zona; outra UF continua unidade distinta |
| ZB05 | Só igualdade de UF+ZE entre anos, reorganização documentada ou conjunto de municípios incompatível | Não atribuir `verified` sem auditoria estrutural; status `uncertain`/`review` e exclusão |
| ZB06 | Registro completo, compatibilidade estrutural comprovada nos três anos e reorganizações verificadas | Match `verified` auditável; detalhe ressalva que seções/eleitores/limites intramunicipais não são garantidos iguais |
| ZB07 | Falta 2018 ou 2022, unidade histórica duplicada ou lacuna de segmentos | Excluir das seis shares e das duas matrizes; preservar bruto e motivos; nenhum reuso histórico |
| ZB08 | ZE inteira sem match, segmentos verificáveis | Somente visualização adicional rotulada município–zona; principal Brasil/UF permanece indisponível/excluída, sem fallback silencioso |
| ZB09 | Exterior `ZZ` | Agregado oficial nacional preserva sua abrangência; coorte inclui apenas representação conciliável separada de UFs, senão exclui com cobertura e motivo explícitos |

### C.C Liderança real

| ID | Entrada/cenário | Resultado esperado |
|---|---|---|
| ZC01 | Outros=410, B=400, L=390; válidos=1200 | `outros`; nenhuma série é artificialmente declarada primeira colocada |
| ZC02 | B=400, L=350, Outros=250 | `bolsonaro` com 40%; não exigir maioria absoluta |
| ZC03 | Empate na maior votação, inclusive dois candidatos de fora das séries | `empate`, sem desempate por ordem/ID; empate abaixo do primeiro lugar não altera líder isolado |
| ZC04 | Válidos=0/ausentes; contagem inconsistente/incompleta | `indefinido`, fora da coorte e pendente; não criar empate nem participação 0 |
| ZC05 | Candidatura com zero válido confirmado e denominador positivo | Zero legítimo preservado; diferente de voto/candidato ausente |

### C.D Matrizes, contagens e invariantes

Aplicar os invariantes para **ambos** os históricos, em cada snapshot e recorte. As contagens são inteiros exatos.

| ID | Entrada/cenário | Resultado esperado |
|---|---|---|
| ZD01 | Coorte elegível com quatro classes | Para 2018/2022/2026, soma B+L+Outros+Empates = tamanho da mesma coorte |
| ZD02 | Matrizes completas 4×4 `2018→2026` e `2022→2026` | Soma das 16 células = coorte; marginais das linhas = líderes históricos, colunas = líderes 2026 |
| ZD03 | Entradas/saídas de cada classe, incluindo outros/empates | `N_X(2026)-N_X(y)=entradas_X-saídas_X`; soma dos quatro saldos = 0 exatamente |
| ZD04 | Célula B→L ou L→B | Ganho direto de uma série = perda direta da outra, **mesmo evento**, sem contar duas vezes |
| ZD05 | 10 ZEs: histórico B6/L4, B→L2, L→B1, demais mantidas | Atual B5/L5, saldos −1/+1, fluxos 2 e 1 legítimos; não exigir igualdade nem saldo individual zero |
| ZD06 | B→Outros, Outros→L, transições de/para Empate e diagonal | Alteram saldos completos; não viram fluxos diretos B↔L; diagonal não é troca |
| ZD07 | Selecionar 2018 ou 2022 no painel | Troca somente matriz/destaque exibido; composição da coorte comum não muda |

### C.E Timeline, ponderação, retificação e coleta

| ID | Entrada/cenário | Resultado esperado |
|---|---|---|
| ZE01 | Fonte validada, cadastro conhecido, nenhuma unidade completa | Coorte/contagens zero, seis shares e quatro deltas `null`; se a fonte nem foi validada, `pending_validation`, sem zeros fabricados |
| ZE02 | Primeira ZE completa e conciliada; depois segunda ZE com peso diferente | As três eleições mudam simultaneamente sobre a mesma C(t); soma de votos / soma de válidos por ano, nunca média de shares |
| ZE03 | Duas unidades com shares B 90/100 e 100/1000 | Share agregado = 190/1100, não 50%; ambas as séries usam o mesmo denominador anual |
| ZE04 | Atualização de votos de uma zona ainda parcial | Não altera membros, lideranças nem matrizes; pode alterar cobertura operacional |
| ZE05 | Nova ZE concluída sem match em um ano | Concluídas 2026 aumenta, comparáveis permanece; motivo nas exclusões |
| ZE06 | Retificação retorna zona a parcial ou invalida votos/match | Retirar/recalcular membro, contagens, shares e matrizes; preservar snapshots anteriores, sem acumulação cega |
| ZE07 | Versões fora de ordem e captura posterior a `asOf` | Última versão efetiva capturada até o corte; sem dados futuros, inclusive decisões de match/cadastro; replay não consulta fonte nem grava resultados |
| ZE08 | Processamento incremental após várias correções | Idêntico à recomputação determinística; sem duplicar membros, histórico ou transições |
| ZE09 | Salvar/remover favorito durante expansão zonal | Inicia/para apenas agregado municipal e muda prioridade zonal; BR/UF e expansão nacional continuam, sem perder acervo |
| ZE10 | EA14/EA15 sem alteração ou CDN zonal atrasada | Varredura periódica de pendentes encontra conclusão; pista não vale como snapshot atômico |
| ZE11 | Orçamento HTTP com 200/304/404/falha e concorrência | 304 consome cota, dedup não cria snapshot; backoff/estado por unidade sem loops 404; favoritos não impedem avanço nacional |
| ZE12 | Coorte parcial disponível e agregado BR/UF mais recente | Agregado oficial continua EA20 próprio; nunca substituir por soma parcial zonal; horário/denominador separados |

### C.F Apresentação

- Brasil/UF mostram **Zonas eleitorais completas/comparáveis**; município mostra **Unidades município–zona**, inclusive tabela/exportação. Não colorir municípios como se fossem ZEs.
- Destacar concluídas 2026, comparáveis e total esperado separadamente; outros/empates explicam residual das duas séries.
- Exibir `2018→2026` / `2022→2026`, matriz completa, composição/método/cobertura e datas. Frase de transição: **Mudança de primeiro colocado na zona**, nunca transferência individual.
- Tabela ordenável/filtrável com UF, município quando aplicável, ZE, líderes dos três anos, válidos por ano, correspondência e instante de conclusão observado.
- Mesma coorte para seis shares, contagens e matrizes; gráficos de contagens em degraus, sem interpolação. Trocar camada/território preserva `asOf`.
- `official_aggregate` e `historical_zone_cohort` têm bases e denominadores explícitos. Fonte pendente: `—`/`Pendente`; vazio comprovado: contagem `0` e share `null`.
- Mostrar `Último processamento zonal` e `Coleta granular em andamento` conforme atraso; nenhum índice subjetivo de confiança ou promessa de tempo real.
- Validar desktop/mobile, acesso por teclado, mapa e ausência de erros de console. Fixture aprovada não autoriza rotular comparação como oficial.

### C.G BU — extensão independente

Preservar testes e fixtures existentes de EA16/EA18. Decodificação de BU, se desenvolvida, exige provas próprias, versões rastreáveis e distinção entre disponibilidade e totalização. O antigo cenário de seções principais/agregadas permanece no histórico documental, **sem ser condição do MVP zonal nem um segundo fluxo comparativo ativo**.

## D. Testes de UX

1. Iniciar em `Fixture` sem internet e navegar Brasil → UF → municípios.
2. Município não monitorado exibe `Não monitorado` no resultado agregado, sem fabricar votos; eventual comparação por segmentos nacionais tem fonte/cobertura próprias.
3. Salvar município inicia agregado municipal e prioriza fila zonal; atualizar navegador mantém favorito. Remoção não interrompe expansão zonal nacional.
4. Resultado, Cobertura e Comparação mantêm seleção de território e instante.
5. Comparação `full` exibe `2026 parcial × histórico final`, sem simular coorte.
6. Comparação `cohort` exibe `Zonas concluídas e conciliadas`, tipo de unidade por recorte, ano de transição, composição, fontes e validação. Antes de habilitar, `pending_validation`, sem exigir BU nem números inventados.
7. TSE fora do ar: dados locais permanecem visíveis com horário e estado `Fonte indisponível`.
8. Slider de tempo usa apenas timestamps reais de snapshots; não suaviza nem interpola votos.
9. Trocar para Governador força seleção adequada de UF e oculta séries históricas presidenciais.
10. Modal/detalhe do indicador apresenta origem e definição do denominador.

## E. Testes operacionais na máquina local

- `pnpm install` sem credenciais privadas.
- `pnpm dev` inicia frontend e backend sem configurações cloud.
- `pnpm test` passa em fixture offline.
- `pnpm build` e typecheck passam.
- Localhost no navegador funciona; a API não está exposta a outros equipamentos por padrão.
- `data/` é ignorado no Git, com exceção de assets pequenos e não sensíveis explicitamente versionados em `packages/fixtures`.
- Logs contêm HTTP status, URL base, erro e latência, mas não exibem dados eleitorais simulados como oficiais.

## F. Primeiras provas de integração exigidas do Codex

Registrar no README, com data e ambiente:

1. Um JSON EA11 efetivamente lido + eleições/códigos encontrados.
2. Um EA14 de simulado lido + atributos usados no detector.
3. Um EA20 de simulado lido + votos e `v.vv` validados com a especificação.
4. EA20 município–zona real/simulado: caminho/abrangência/identificadores, campos de conclusão e exceções, votos válidos e destinação; não inferir contrato apenas de EA20 municipal.
5. Comparação entre CSV nominais **por município e zona** de 2018 e 2022: colunas reais, encoding, cargo/turno, IDs, todos os candidatos, categorias de voto e denominadores. Arquivar original e versão transformada.
6. Cadastro completo de segmentos de ZE 2026; ao menos uma zona com mais de um município; correspondência estrutural auditável com ambos os históricos, reorganizações e tratamento de ZZ.
7. Medidas de capacidade: segmentos/ZE esperados, bytes médios, requests inclusive 304, tempo de varredura, atraso até conclusão, defasagem zona/agregados e percentual conciliável.
8. Declaração separada: **coleta e reconciliação nacional por zona validadas no ambiente oficial?** Informar sim/não com evidência. Fixtures/simulado não comprovam operação oficial nacional. Nesta revisão: **não**.
9. BU, se houver avanço experimental, tem registro independente; não bloquear as provas zonais por ausência de decodificador.

## G. Execução registrada em 02/10/2026 — etapas 0 e 1

Detalhes e evidências em [VALIDACAO.md](VALIDACAO.md). Registro anterior ao Aditivo 01, preservado; não comprova os novos testes zonais C.A–C.F. Versão documental anterior arquivada em `history/pre-aditivo-01/`.

- [x] EA11 oficial e EA11/12/14/15/16/18/20 do simulado capturados, com manifests e hashes.
- [x] Schemas mínimos e paths derivados de EA11. EA15 aceita 22 municípios + linha da própria UF em AC; EA20 municipal usa `mu`, EA15 usa `mun`.
- [x] Fase/turno/cargo/eleição/abrangência, zeros iniciais, dv=n, contagens e denominadores testados.
- [x] SQLite WAL, migration, snapshots/brutos imutáveis, deduplicação, revisão e persistência após reinício.
- [x] API fixture com `/latest`, série, cobertura, proveniência, busca e watchlist; coleta municipal fixture apenas de salvos.
- [x] Mapa offline das 27 UFs e 22 municípios do Acre. Timeline discreta, duas escalas, replay e atualização sintética explícita.
- [x] Comparação indisponível com justificativa e capacidades desativadas; nenhuma identidade resolvida por nome.
- [x] Fluxo de navegador com bloqueio de rede externa, preservação do último dado após falha local e screenshots desktop/mobile.
- [ ] Scheduler/cache/304/backoff/404 de produção: etapa 2. Scripts de observação não fazem retries.
- [ ] CSV históricos e identidades oficiais 2026: a validar. BU também não foi decodificado; após o aditivo, é extensão independente.
- [ ] Malhas municipais de outras UFs, coleta real, SSE e entrega operacional completa: pendentes.

## H. Migração do Aditivo 01 — escopo e acompanhamento

- [x] Especificação 1.1, AGENTS.md e contratos reorientados para EA20 município–zona, ZE completa, lideranças e transições; originais arquivados, aditivo preservado.
- [x] Caminho crítico BU removido da comparação; fontes/fixtures/testes anteriores continuam válidos no respectivo escopo.
- [x] Execução inicial dos casos zonais com fixtures e recortes TSE, discriminada abaixo; não equivale à aprovação integral de C.A–C.F no oficial.
- [ ] Coleta e conciliação nacional zonal oficial: **não validadas**.

Registrar ajustes de contrato/texto da aplicação e regressões desta revisão em `VALIDACAO.md`, com comandos efetivamente executados. Não transformar este checklist de requisitos em relatório de testes aprovados.

## I. Evidência executável adicionada às 21h de 02/10/2026

O checklist G descreve a entrega anterior. A comparação atual está ativa **somente em fixture**; `officialStatus=pending_validation`, `historical=false` no bootstrap significa que a aplicação não habilitou os históricos reais importados no banco separado.

| Teste | Casos cobertos e limite |
|---|---|
| `packages/tse/src/zones.test.ts` | Hashes de seis downloads, path via EA11, vínculo município/URL, três segmentos da ZE0008 AC, fase incompatível, exceção sni=1 em revisão e oficial st=0 parcial. Não comprova conclusão oficial positiva |
| `packages/domain/src/zones.test.ts` | ZB01/02/07, ZC01–04, ZD01–07, ZE01/02/06/07 em cenários sintéticos: completude, terceiros, empate, denominador zero, pesos diferentes, duplicação, retificação e revogação de match. Exemplo ZD05 6/4→5/5 com fluxos 2 e 1 executado |
| `packages/tse/src/history.test.ts` | CSV reais AC, Windows-1252, todos os 13/11 candidatos, IDs com zeros preservados, ano errado/duplicação/truncamento rejeitados; igualdade estrutural exige auditoria adicional. Não certifica reorganizações |
| `apps/api/src/db/zones.test.ts` | Upgrade v1→v3 preserva estado; deduplicação/reinício; isolamento; histórico normalizado imutável e sem match automático |
| `apps/api/src/app.test.ts` | API fixture diferencia ZE/segmento, leitura sem escrita, replay e reversão após correção, capacidades oficiais fechadas |
| `packages/tse/src/collector.test.ts` | Parte de ZE09/11: orçamento, 304, cache condicional, 404 suspenso, pausa 429, backoff e justiça entre favoritos/não favoritos com transporte simulado. Não é teste de coletor de produção |
| E2E offline | Camadas, mapa, seis shares, matriz 4×4 com seletor, contagens, tabela, timeline, replay, favoritos, falhas e desktop/mobile; nenhuma chamada externa |

Pendentes para aceite integral: conclusão positiva no oficial, demais exceções, correspondência nacional auditada e exterior, transporte/cache/fila persistida reais, deduplicação real de HTTP 200, métricas de atraso/defasagem, camada cartográfica comparativa, exportação analítica e histórico final de referência territorial. Não usar esta tabela para marcar os casos restantes como aprovados.
