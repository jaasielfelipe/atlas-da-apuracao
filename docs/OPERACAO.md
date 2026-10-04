# Operação local

Guia vigente (04/10/2026). Para instalar do zero numa máquina nova: [REPLICAR.md](REPLICAR.md). Execução do domingo passo a passo: [CHECKLIST_DOMINGO.md](CHECKLIST_DOMINGO.md). Evidências e o que foi ou não comprovado: [VALIDACAO.md](VALIDACAO.md). Versão anterior, acumulada por incrementos: [history/2026-10-03/OPERACAO.md](history/2026-10-03/OPERACAO.md).

## Processos e bancos

| Processo | Comando | Escreve em |
|---|---|---|
| API + painel | `pnpm build && pnpm start` (`127.0.0.1:3001`) ou `pnpm dev` (`5173` + `3001`) | `data/atlas.sqlite` (fixture); watchlist dos bancos de coleta |
| Coletor oficial contínuo | `pnpm collect:official:live` | `data/official/collection.sqlite`, `collector-status.json` |
| Coletor simulado contínuo | `pnpm collect:simulated:live` | `data/simulated/collection.sqlite` |
| Histórico 2018/2022 | `pnpm import:history` (uma vez) | `data/history/atlas-history.sqlite` |

A API só lê os bancos de coleta (WAL permite ler enquanto o coletor escreve), exceto a watchlist. Nunca rodar dois coletores TSE na mesma máquina ou no mesmo IP: o lock `data/national-benchmark/active.lock` (com PID) impede na máquina; outras máquinas no mesmo IP não são detectadas. `ATLAS_DB`, `OFFICIAL_DB`, `SIMULATED_DB` e `HISTORY_DB` trocam os caminhos usados pela API.

## Páginas

- `/` — demonstração fixture (dados sintéticos, botão “Próxima captura sintética”).
- `/live/official` — painel oficial: mapa Brasil → UF → município (malha IBGE de todas as UFs), Resultado/Cobertura/Comparação, timeline, favoritos. Atualiza a cada 20 s em “Agora”.
- `/live/simulated` — mesmo painel sobre o simulado; sem comparação histórica (candidaturas simuladas não se vinculam às séries).
- `/official` e `/simulated` redirecionam para `/live/<env>`.
- `/live/official/telao` (também `/live/simulated/telao` e `/telao` para a fixture) — **telão**: visão nacional de Presidente para tela grande; palco fixo 1920×1080 escalado à janela, tema escuro (`?tema=claro` para claro). Centro: pista serpentina de Lula (vermelho) × Flávio (verde), 0–55% dos aptos em votos, linha fixa de 50% dos aptos e meta ajustada (metade dos válidos ainda possíveis). Esquerda: desfechos em cartões (2º turno confirmado, vitória matemática de cada um — acendem só quando garantidos pelos números publicados), totais da apuração, indicadores discretos, mesmas zonas × 2022/2018. Direita: mapa por UF com foco rotativo (reage a boletins novos), feed “Chegando agora” (unidades município–zona com seções novas e votos acrescentados nesta eleição, rota `/api/v1/live/<env>/zone-feed`) e evolução das mesmas zonas com eixo fixo de 0 ao total de zonas. Base: mosaico das UFs por região, largura proporcional ao eleitorado. Atualiza o agregado a cada 5 s, UFs e feed a cada 10 s, comparação e coletor a cada 30 s (`/status`, sem catálogo). Movimento só onde informa (dígitos rolantes nos números principais, chegada de boletins, foco do mapa, feed); desligado com `prefers-reduced-motion`. Demonstração: `/telao?demo` (`?demo=vitoria`, `&ritmo=1500`), dados sintéticos gerados no navegador.

A API é a mesma para os três ambientes (`apps/api/src/services/dashboard.ts`): `/api/v1/…` (fixture) e `/api/v1/live/<env>/…`, com `bootstrap`, `territories`, `watchlist`, `latest`, `snapshots`, `coverage`, `map`, `comparison`, `sources/:id`. No ao vivo, `bootstrap.collection` traz cobertura zonal (segmentos observados, ZEs inteiras concluídas) e estado do coletor (lease SQLite + heartbeat).

## Coletor contínuo

Decisão do usuário (03/10/2026): até **80 req/s** (TSE anuncia 100 req/s por IP; 304 conta). Teto rígido `MAX_RPS = 80` em `packages/tse/src/collector.ts`, rajada ≤ 4 (nenhuma janela de 1 s acima de 84), até 128 em voo.

| Variável | Padrão | Uso |
|---|---|---|
| `TSE_RPS` | 80 | alvo, ≤ 80 |
| `TSE_RPS_START` | 10 | início da rampa (+10 a cada 15 s sem erros) |
| `TSE_MAX_IN_FLIGHT` | 64 | ≤ 128 |
| `COLLECT_SECONDS` | 0 | 0 = até Ctrl+C |

Perfil `LIVE_PROFILE` (`apps/api/src/services/national.ts`): zonas pendentes a cada 120 s, zonas completas auditadas a cada 30 min, agregados BR/UF dos dois cargos a cada 20 s, EA14 10 s, EA15 30 s, municípios salvos 30 s. Demanda com todas as zonas pendentes ≈ 57 req/s. `due` é elegibilidade, não garantia de frescor.

- **Bloqueio 403/429:** pausa global ≥ 10 min (ou `Retry-After`) e taxa no piso, depois nova rampa. 404 suspende a unidade, sem loop. 5xx/rede acima de 5%: taxa cai à metade; unidades em backoff (≤ 10 min).
- **Corpo rejeitado** (fase, eleição, cadastro, identificadores): não entra em cache nem no acervo; fica em `collector_observation.error` e em `recentErrors` do status.
- **Queda/reinício:** rodar de novo. O lock de PID morto é recuperado; o lease anterior (60 s) é aguardado; fila, ETags e cota retomam do SQLite.
- **Favoritos:** salvar/remover no painel; o coletor relê a cada 10 s e inicia/suspende o agregado municipal. Zonas são sempre nacionais.
- **Mudança de cadastro EA11/EA12:** o coletor recusa iniciar (“Banco/eleição/cadastro incompatível”). Fazer backup, mover o banco e reiniciar; o aceite territorial vale só para o cadastro aceito.
- **Status:** linha a cada 10 s no console e `data/<env>/collector-status.json` (taxa atual/observada, em voo, pausa, eventos de rampa, respostas, cobertura, últimos erros).

Ensaios limitados com o perfil antigo de 2 req/s continuam disponíveis: `pnpm collect:official` / `pnpm collect:simulated` (`COLLECT_SECONDS` 10–180; param no primeiro não-200/304).

## Backup

`pnpm backup [fixture|official|simulated|<arquivo.sqlite>]` usa a API de backup do SQLite (inclui WAL, seguro com o coletor rodando) e verifica `integrity_check`. Saída em `data/backups/`. Não copiar só o arquivo principal enquanto há escritas no WAL.

## Históricos reais (2018/2022)

Arquivos ZIP (~951,5 MB) e CSV presidenciais ficam em `data/history` (fora do Git). Para reproduzir numa máquina limpa: `node scripts/download-history.mjs`, `powershell -File scripts/extract-history.ps1`, `pnpm inspect:history`, `pnpm import:history`. Não carregar `BRASIL.csv` (outros cargos, vários GB). Aceite territorial do usuário: `pnpm accept:territorial-audit` reproduz a decisão já registrada (2.580 ZEs / 5.940 segmentos, método `user_accepted_structural`); não usar para aceitar cadastros novos.

## Malhas

`packages/fixtures/maps/<uf>-municipalities.geojson` (IBGE API v3, `qualidade=minima`, 5.570 municípios) e `br-ufs.geojson`. `node scripts/download-maps.mjs` reproduz o download, recusa sobrescrever conteúdo diferente e registra hashes em `municipalities-manifest.json`.

## Ferramentas de desenvolvimento (opt-in, rede)

`pnpm observe:tse`, `node scripts/observe-extra.mjs` (substituem fixtures de observação; revisar hashes/testes após uso), `pnpm benchmark:national`, `pnpm benchmark:concurrent`, `pnpm reconcile:national`, `pnpm simulate:national`, `pnpm report:national`, `pnpm benchmark:local-national`. Nunca executados pelo servidor.
