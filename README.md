# Atlas da Apuração

Painel **local, de usuário único** (`127.0.0.1`) para a apuração das Eleições Gerais 2026, 1º turno, Presidente e Governador. Mapa Brasil → UF → município, camadas Resultado / Cobertura / Comparação e timeline de capturas imutáveis. Fonte primária: arquivos públicos de divulgação do TSE (EA11/EA12/EA14/EA15/EA20).

Três ambientes, nunca misturados:

| Ambiente | Página | Dados |
|---|---|---|
| Demonstração | `/` | fixture sintética (Acre), identificada permanentemente |
| Oficial | `/live/official` | banco do coletor oficial (`data/official/collection.sqlite`) |
| Simulado | `/live/simulated` | banco do coletor do ambiente de testes do TSE |

Comparação analítica presidencial (séries `bolsonaro` e `lula_haddad`, 2018 / 2022 / 2026) somente sobre **zonas eleitorais inteiras concluídas** e conciliadas com os históricos finais, com contagens de liderança e matrizes `2018→2026` / `2022→2026`. Regras completas em [AGENTS.md](AGENTS.md), [especificação](docs/ESPECIFICACAO.md) e [Aditivo 01](docs/ADITIVO_01_COMPARACAO_ZONAS_ATLAS.md).

## Executar

Requisitos: Node.js 22.12+ (validado com 24.19.0 LTS), pnpm 11.19.0, navegador com WebGL.

```sh
pnpm install
pnpm build
pnpm start                     # painel e API em http://127.0.0.1:3001
pnpm collect:official:live     # em outro terminal: coleta oficial contínua (até 80 req/s)
```

Desenvolvimento: `pnpm dev` (frontend em `127.0.0.1:5173`, API em `3001`). Operação, variáveis, incidentes e backup: [docs/OPERACAO.md](docs/OPERACAO.md). Domingo 04/10: [docs/CHECKLIST_DOMINGO.md](docs/CHECKLIST_DOMINGO.md).

## Verificação

```sh
pnpm typecheck
pnpm test          # unitários e integração (somente fixtures; sem rede)
pnpm build
pnpm test:e2e      # inicia servidores próprios com bancos semeados em tmp/e2e; deixe 5173 e 3001 livres
pnpm format:check
```

No Windows o E2E usa o Edge instalado; em outros sistemas `pnpm exec playwright install chromium` (ou `PLAYWRIGHT_CHANNEL`). O E2E bloqueia e denuncia solicitações externas no fluxo fixture.

## Estrutura

- `apps/api` — Fastify, SQLite WAL (migrations 001–005), rotas do painel compartilhadas entre ambientes (`services/dashboard.ts`), fontes fixture/ao vivo, coletor persistente e planejamento nacional.
- `apps/web` — React/Vite, MapLibre (malhas IBGE locais), ECharts. `environment.ts` concentra o que muda por ambiente; `useDashboard.ts` o estado; `components/` os painéis.
- `packages/domain` — contratos, métricas puras, motor de coorte zonal e matrizes.
- `packages/tse` — schemas, descoberta EA11, URLs, adapters, fila com teto de taxa e controlador de rampa.
- `packages/fixtures` — capturas originais TSE com manifestos e hashes (não reformatar JSON bruto), malhas IBGE, recortes históricos.
- `scripts` — coletores (`collect-live.ts`, ensaios limitados), importação de históricos, backup, downloads de malhas, benchmarks.
- `docs` — ver [docs/README.md](docs/README.md).

## Estado

Pronto para operação em 04/10/2026: coleta contínua ensaiada no simulado (varredura nacional em ~2 min 21 s, 0 erros), queda e reinício ensaiados, fumaça oficial sem erros. **Coleta e conciliação nacional oficial com resultados ainda não comprovadas**: o TSE só publica totalização após o encerramento da votação. Detalhes e evidências em [docs/VALIDACAO.md](docs/VALIDACAO.md).

Fontes: [documentação técnica TSE](https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados), [EA11 oficial](https://resultados.tse.jus.br/oficial/comum/config/ele-c.json), [malhas IBGE](https://servicodados.ibge.gov.br/api/docs/malhas?versao=3).
