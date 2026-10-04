# Atlas da Apuração

Painel **local, de usuário único** (`127.0.0.1`) para acompanhar a apuração das Eleições Gerais 2026 — 1º turno, Presidente e Governador — a partir dos arquivos públicos de divulgação do TSE (EA11/EA12/EA14/EA15/EA20). Sem contas, sem nuvem, sem Docker.

Dois modos, servidos pelo mesmo servidor:

| | Telão | Painel explorador |
|---|---|---|
| Endereço | `/live/official/telao` | `/live/official` |
| Para | tela grande, acompanhar a noite | investigar território a território |
| Mostra | pista Lula × Flávio rumo à maioria absoluta, totais, desfechos aritméticos (2º turno confirmado, vitória matemática), mapa com foco rotativo, feed das zonas que acabaram de chegar, mosaico das UFs por região, mesmas zonas × 2022 | mapa Brasil → UF → município, Resultado / Cobertura / Comparação, linha do tempo com replay, municípios salvos |

## Começar em 3 minutos

Requisitos: Git, Node.js 22.12+ (validado com 24.19 LTS), pnpm 11.19.0.

```sh
git clone https://github.com/jaasielfelipe/atlas-da-apuracao.git
cd atlas-da-apuracao
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

- Demonstração do telão em movimento (dados sintéticos): <http://127.0.0.1:3001/telao?demo>
- Painel explorador com a fixture: <http://127.0.0.1:3001/>

**Apuração oficial ao vivo:** deixe `pnpm start` rodando e, em outro terminal, `pnpm collect:official:live`. Depois abra <http://127.0.0.1:3001/live/official/telao> ou <http://127.0.0.1:3001/live/official>.

Passo a passo completo — níveis (demonstração, oficial, completo com 2018/2022), regras de operação, portas e problemas comuns: **[docs/REPLICAR.md](docs/REPLICAR.md)**.

## Regras do projeto

Fonte primária TSE; nada simulado ou sintético apresentado como oficial; zero ≠ ausente; sem previsões, probabilidades ou narrativa — só números publicados e fatos aritméticos que eles garantem. Comparação histórica apenas em **zonas eleitorais inteiras concluídas** e conciliadas (séries `bolsonaro` e `lula_haddad`, 2018 / 2022 / 2026). Regras completas e decisões do usuário em [AGENTS.md](AGENTS.md); especificação em [docs/ESPECIFICACAO.md](docs/ESPECIFICACAO.md) e [Aditivo 01](docs/ADITIVO_01_COMPARACAO_ZONAS_ATLAS.md).

## Verificação

```sh
pnpm typecheck
pnpm test          # unitários e integração (só fixtures; sem rede)
pnpm build
pnpm test:e2e      # servidores próprios, bancos semeados em tmp/e2e
pnpm format:check
```

## Estrutura

- `apps/api` — Fastify + SQLite WAL; rotas compartilhadas entre ambientes (`services/dashboard.ts`), acervos ao vivo, feed de zonas, coletor persistente e planejamento nacional.
- `apps/web` — React/Vite. Painel explorador em `components/` (`environment.ts`, `useDashboard.ts`); telão em `telao/` (pista, mapa rotativo, mosaico, feed, desfechos, demonstração).
- `packages/domain` — contratos, métricas, motor de coorte zonal.
- `packages/tse` — schemas, descoberta EA11, URLs, fila com teto de taxa e controlador de rampa.
- `packages/fixtures` — capturas originais do TSE com hashes, malhas IBGE, recortes históricos.
- `scripts` — coletores, importação de históricos, backup, malhas, benchmarks.
- `docs` — ver [docs/README.md](docs/README.md).

## Estado

Coleta contínua ensaiada no simulado (país inteiro em ~2 min 21 s, 0 erros; soak de 30 min), queda e reinício ensaiados, operação oficial ligada em 04/10/2026. Coleta e conciliação nacional oficial **com resultados** só podem ser declaradas a partir do acervo da noite — ver [docs/VALIDACAO.md](docs/VALIDACAO.md). Versão estável anterior ao telão: tag `v1.0-eleicao-2026`.

Fontes: [documentação técnica TSE](https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados), [EA11 oficial](https://resultados.tse.jus.br/oficial/comum/config/ele-c.json), [malhas IBGE](https://servicodados.ibge.gov.br/api/docs/malhas?versao=3).
