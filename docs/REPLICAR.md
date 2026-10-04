# Replicar o Atlas da Apuração localmente

Guia único para **pessoas e agentes** reproduzirem o painel numa máquina nova. Tudo roda em `127.0.0.1`, sem contas, sem nuvem e sem Docker. Há dois modos de visualização servidos pelo **mesmo servidor**:

| Modo | Endereço | Para quê |
|---|---|---|
| **Telão** | `http://127.0.0.1:3001/live/official/telao` | Tela grande (1920×1080, escala para qualquer janela), visão nacional de Presidente: pista de Lula × Flávio, totais, desfechos aritméticos, mapa com foco rotativo, feed “Chegando agora”, mosaico de UFs por região, mesmas zonas × 2022 |
| **Painel explorador** | `http://127.0.0.1:3001/live/official` | Navegação Brasil → UF → município, camadas Resultado / Cobertura / Comparação, linha do tempo e replay, municípios salvos |

Os mesmos dois modos existem para o ambiente de testes do TSE (`/live/simulated/telao`, `/live/simulated`) e para a demonstração sintética (`/telao`, `/`).

## 1. Pré-requisitos

- Git.
- **Node.js 22.12 ou superior** (validado com 24.19.0 LTS).
- **pnpm 11.19.0**: `npm install -g pnpm@11.19.0` (ou `corepack enable && corepack prepare pnpm@11.19.0 --activate`).
- Navegador moderno com WebGL (Edge ou Chrome). No Windows os testes E2E usam o Edge instalado.
- Espaço em disco: ~1 GB para os históricos (opcional) e ≥ 10 GB livres na noite da apuração.

## 2. Instalar e verificar

```sh
git clone https://github.com/jaasielfelipe/atlas-da-apuracao.git
cd atlas-da-apuracao
pnpm install --frozen-lockfile
pnpm build
pnpm test
```

`pnpm test` roda só com fixtures, sem rede. Opcional: `pnpm test:e2e` (sobe servidores próprios em 5173/3001 com bancos semeados em `tmp/e2e`; use `ATLAS_API_PORT`/`ATLAS_WEB_PORT` se essas portas estiverem ocupadas).

## 3. Escolha o nível

### Nível 0 — demonstração (sem rede, sem dados)

```sh
pnpm start
```

- Telão em movimento com apuração sintética: `http://127.0.0.1:3001/telao?demo` (`?demo=vitoria` mostra a vitória matemática; `&ritmo=1500` acelera os boletins).
- Painel explorador com a fixture: `http://127.0.0.1:3001/`.

Tudo é marcado como DEMONSTRAÇÃO/FIXTURE; nada disso é resultado.

### Nível 1 — apuração oficial ao vivo (sem comparação histórica)

Dois terminais na raiz do projeto:

```sh
# Terminal 1 — servidor (telão + painel explorador)
pnpm start

# Terminal 2 — coletor oficial contínuo (até 80 req/s, rampa a partir de 10)
pnpm collect:official:live
```

O coletor descobre a eleição pelo EA11 do TSE, cria `data/official/collection.sqlite` e varre o país inteiro (6.292 unidades município–zona) em ~2–3 min. O TSE só publica totais depois do fim da votação; antes disso as telas mostram zero apurado e “—” onde não há dado. A seção “Mesmas zonas” fica indisponível neste nível (falta o histórico).

### Nível 2 — completo (com 2018/2022 e “mesmas zonas”)

Uma vez, antes de ligar o coletor:

```sh
node scripts/download-history.mjs            # 2 ZIPs do TSE, ~951 MB, sem repetição automática
# extrair os CSV presidenciais nacionais:
powershell -File scripts/extract-history.ps1  # Windows
# macOS/Linux (mesmos bytes):
#   unzip -p data/history/2018.zip votacao_candidato_munzona_2018_BR.csv > data/history/2018-BR.csv
#   unzip -p data/history/2022.zip votacao_candidato_munzona_2022_BR.csv > data/history/2022-BR.csv
pnpm import:history                           # cria data/history/atlas-history.sqlite
pnpm accept:territorial-audit                 # reproduz o aceite territorial já registrado (offline)
```

O último passo confere os SHA-256 dos CSV contra os manifestos versionados em `packages/fixtures/history/` e reaplica a decisão do usuário registrada em `docs/evidence/national/territorial-user-acceptance.json` (2.580 zonas / 5.940 segmentos, método `user_accepted_structural`). Se o TSE republicar os ZIPs com outro conteúdo, os hashes não batem e o passo recusa: não contorne, registre e reavalie.

Depois disso, siga o nível 1.

## 4. Regras de operação (valem para pessoas e agentes)

- **Um único coletor TSE por máquina e por IP.** O lock `data/national-benchmark/active.lock` impede dois na mesma máquina; outras máquinas no mesmo IP não são detectadas. Nunca rode o coletor oficial e o simulado ao mesmo tempo.
- **Taxa:** teto de 80 req/s (decisão do usuário; o TSE anuncia 100 req/s por IP e bloqueia por 10 min). Para reduzir: `TSE_RPS=20 pnpm collect:official:live` (PowerShell: `$env:TSE_RPS=20; pnpm collect:official:live`). Em 403/429 o coletor pausa sozinho ≥ 10 min.
- **Parar:** Ctrl+C no coletor (drena requisições e libera lease/lock). Reiniciar é seguro: retoma do SQLite; após queda abrupta espera o lease anterior (≤ 60 s).
- **Backup a qualquer momento:** `pnpm backup official` (cópia consistente, com `integrity_check`).
- Simulado e demonstração nunca são apresentados como oficiais; as telas carregam selo próprio.

## 5. Portas e caminhos

| Variável | Padrão | Uso |
|---|---|---|
| `ATLAS_API_PORT` | 3001 | porta do servidor (`pnpm start`) |
| `ATLAS_WEB_PORT` | 5173 | porta do Vite em `pnpm dev` |
| `OFFICIAL_DB` | `data/official/collection.sqlite` | acervo oficial lido pelo servidor |
| `SIMULATED_DB` | `data/simulated/collection.sqlite` | acervo simulado |
| `HISTORY_DB` | `data/history/atlas-history.sqlite` | históricos 2018/2022 |
| `ATLAS_DB` | `data/atlas.sqlite` | demonstração/fixture |

Para rodar uma segunda cópia ao lado de outra (por exemplo, uma tela num servidor separado lendo o mesmo acervo): `ATLAS_API_PORT=3101 OFFICIAL_DB=<caminho>/collection.sqlite pnpm start`. O servidor só lê os acervos (exceto a lista de municípios salvos).

## 6. Conferir que está tudo certo

- `http://127.0.0.1:3001/health` responde `ok`.
- `http://127.0.0.1:3001/api/v1/live/official/status` mostra `collection.running: true` e a cobertura (segmentos observados / esperados).
- `data/official/collector-status.json` é atualizado a cada 10 s (taxa, pausas, erros recentes).
- No telão, o anel ao lado de “Ao vivo” gira a cada verificação (5 s).

## 7. Problemas comuns

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| “Acervo official ainda não coletado” | coletor nunca rodou | inicie `pnpm collect:official:live` |
| Coletor recusa: “Outro coletor TSE ativo” | já há um coletor nesta máquina | use o existente; não rode dois |
| Coletor recusa: “Banco/eleição/cadastro incompatível” | o TSE mudou EA11/EA12 | faça backup, mova o banco para outra pasta e reinicie (banco novo) |
| “Mesmas zonas” indisponível | histórico ausente | siga o nível 2 |
| Telão não aparece em `/live/official/telao` | build antigo | `pnpm build` e reinicie `pnpm start` |
| Porta ocupada | outro processo em 3001/5173 | ajuste `ATLAS_API_PORT`/`ATLAS_WEB_PORT` |

Mais detalhes: [OPERACAO.md](OPERACAO.md) (guia de operação), [CHECKLIST_DOMINGO.md](CHECKLIST_DOMINGO.md) (noite da apuração), [VALIDACAO.md](VALIDACAO.md) (o que foi comprovado).
