# Contratos, provas de integração e testes — Atlas da Apuração

Leia primeiro `ESPECIFICACAO.md`. Este arquivo fornece uma agenda operacional testável; não substitui os documentos EA oficiais.

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

## B. Testes do banco

- Snapshots são imutáveis e deduplicados por digest + território + eleição + fase.
- Dois arquivos de abrangências diferentes não se sobrescrevem, ainda que tenham horários próximos.
- Guardar UTC de captura, fonte `dg/hg` e totalização `dt/ht` separadamente.
- Desligar/religar o app mantém watchlist e snapshots e não replica eventos já persistidos.
- `simulated` e `official` nunca têm consultas que se misturem por padrão.

## C. Testes de coorte histórica

Criar uma fixture sintética com, por exemplo, seis unidades 2026: três exatas nos dois anos, uma principal com duas agregadas conciliáveis, uma sem chave em 2018, uma com duplicidade histórica. Esperado:

- Exatas e agregação verificada entram na coorte.
- Sem 2018 e duplicada ficam fora, com motivos distintos.
- Uma seção histórica não conta duas vezes.
- Todos os seis percentuais das duas séries usam exatamente a mesma coorte comum de unidades 2026, com denominador por ano.
- Diferença em pontos percentuais usa `100*(p2026-pHist)`.
- Dados sem denominação -> `share=null`.
- Quando BU disponível antecede EA20, status = `not_reconciled`, nunca `official_totalized`.
- Alteração de hash de BU mantém artefato anterior rastreável, mas coorte utiliza versão válida/efetiva.
- Quando o usuário remove um município da watchlist, a coleta para, mas snapshots continuam consultáveis.

## D. Testes de UX

1. Iniciar em `Fixture` sem internet e navegar Brasil → UF → municípios.
2. Município não monitorado exibe contorno neutro, `Não monitorado`, e nenhum resultado municipal.
3. Salvar município inicia somente os jobs previstos; atualizar o navegador mantém favorito.
4. Resultado, Cobertura e Comparação mantêm seleção de território e instante.
5. Comparação `full` exibe `2026 parcial × histórico final`, sem simular coorte.
6. Comparação `cohort` exibe `Boletins disponíveis`, coorte e status de reconciliação.
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
4. Uma comparação entre estrutura dos CSV históricos de 2018 e 2022 — colunas reais, encoding, turno, identificadores de seção e categoria de voto.
5. Estado do decodificador BU de 2026: `validado` ou `a validar`, com evidência; **nunca afirmar conclusão sem teste**.

## G. Execução registrada em 02/10/2026 — etapas 0 e 1

Detalhes e evidências em [VALIDACAO.md](VALIDACAO.md). A especificação original permanece preservada; este registro descreve apenas a implementação entregue.

- [x] EA11 oficial e EA11/12/14/15/16/18/20 do simulado capturados, com manifests e hashes.
- [x] Schemas mínimos e paths derivados de EA11. EA15 aceita 22 municípios + linha da própria UF em AC; EA20 municipal usa `mu`, EA15 usa `mun`.
- [x] Fase/turno/cargo/eleição/abrangência, zeros iniciais, dv=n, contagens e denominadores testados.
- [x] SQLite WAL, migration, snapshots/brutos imutáveis, deduplicação, revisão e persistência após reinício.
- [x] API fixture com `/latest`, série, cobertura, proveniência, busca e watchlist; coleta municipal fixture apenas de salvos.
- [x] Mapa offline das 27 UFs e 22 municípios do Acre. Timeline discreta, duas escalas, replay e atualização sintética explícita.
- [x] Comparação indisponível com justificativa e capacidades desativadas; nenhuma identidade resolvida por nome.
- [x] Fluxo de navegador com bloqueio de rede externa, preservação do último dado após falha local e screenshots desktop/mobile.
- [ ] Scheduler/cache/304/backoff/404 de produção: etapa 2. Scripts de observação não fazem retries.
- [ ] CSV históricos, identidades oficiais 2026 e decodificação/conciliação BU: a validar.
- [ ] Malhas municipais de outras UFs, coleta real, SSE e entrega operacional completa: pendentes.
