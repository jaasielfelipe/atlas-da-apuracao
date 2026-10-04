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

## Fonte de referência

TSE: https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados

Confira `docs/CONTRATOS_E_TESTES.md` para cenários de verificação e checklists. Atualize a documentação quando uma hipótese técnica for confirmada por arquivos reais.

## Decisão operacional vigente — 03/10/2026

O usuário determinou: “considere auditoria realizada. vamos com estado atual. pode atualizar o status”. Esta decisão substitui a pendência de aceite da auditoria para as **2.580 ZEs domésticas de composição municipal compatível com ambos os históricos**, correspondentes a 5.940 segmentos. Registrar `verified` com método `user_accepted_structural`, ator `user`, instante e hashes; não atribuir ao agente uma auditoria documental que ele não realizou. As 61 ZEs/352 segmentos incompatíveis, ausentes ou do exterior continuam excluídos. Igualdade de códigos não passa a promover novos cadastros automaticamente.

O aceite é imutável, vale para o cadastro e imports vinculados e só entra no replay a partir de sua captura. Preservar as provas anteriores em `review`. Histórico final nominal de 2018/2022 pode alimentar o motor com `basis=historical_final` e contagens de seções nulas; em 2026 continua obrigatório EA20 consistente e ZE inteira concluída. Não transformar o aceite em aprovação da coleta nacional oficial nem combinar candidaturas simuladas com as séries oficiais. Evidência: `docs/evidence/national/territorial-user-acceptance.json`.

## Decisão operacional vigente — taxa TSE, 03/10/2026

O usuário determinou: “TSE asks for maximum of 100 requests per second. we may use this with some safety range (let's say, 80 requests per second)”. Esta decisão substitui o padrão 2–5 req/s da regra 5 **somente** para a coleta contínua (`collect:official:live` / `collect:simulated:live`). Teto rígido em código: `MAX_RPS = 80` inícios/s (`packages/tse/src/collector.ts`), rajada GCRA ≤ 4 (nenhuma janela de 1 s acima de 84), até 128 em voo; 304 continua contando. A taxa sobe em rampa (10 → 80, +10 a cada 15 s limpos), cai à metade com >5% de erros 5xx/rede e vai ao piso com 403/429, além da pausa global ≥10 min. Um único coletor por máquina/IP (lock com PID), nunca oficial e simulado simultâneos. Ensaios limitados (`collect:official`/`collect:simulated`) mantêm o perfil conservador. Toolchain local: Node 24 LTS + pnpm 11.19.0 instalados na máquina.

## Estado atual — 03/10/2026, noite

- **Coleta:** `collect:official:live` / `collect:simulated:live` contínuos sob a decisão de 80 req/s; ensaiados no simulado (varredura nacional em ~2 min 21 s, 0 erros; soak de 30 min), queda/reinício e fumaça oficial. Ensaios limitados de 2 req/s preservados.
- **Painel:** uma única API (`apps/api/src/services/dashboard.ts`) para fixture (`/api/v1`) e acervos ao vivo (`/api/v1/live/<env>`); frontend em `/`, `/live/official`, `/live/simulated` (malha municipal IBGE de todas as UFs; favoritos sincronizam o coletor). As antigas páginas de acervo foram incorporadas ao painel.
- **Comparação:** históricos finais 2018/2022 em `data/history/atlas-history.sqlite` com o aceite do usuário acima; 2026 exige EA20 consistente e ZE inteira concluída.
- **Não comprovado:** coleta e conciliação nacional oficial com resultados (TSE publica após 17h de 04/10/2026). Declarar somente com base no acervo oficial.
- Antes de continuar: [docs/README.md](docs/README.md), [docs/OPERACAO.md](docs/OPERACAO.md), [docs/VALIDACAO.md](docs/VALIDACAO.md) (resumo no topo) e [docs/CHECKLIST_DOMINGO.md](docs/CHECKLIST_DOMINGO.md). Estados datados anteriores: `docs/history/2026-10-03/AGENTS.md`.

## Decisões do usuário — telão, 04/10/2026

- **Cores:** Lula = vermelho, Flávio = verde (“Cores: Lula = Vermelho, Flávio = Verde”). Aplicadas às séries `lula_haddad` e `bolsonaro` por identidade (nunca por posição). Par validado para deficiência de visão de cores (tema escuro `#be2b2b`/`#33ab64`, ΔE CVD 12,3; claro `#e5484d`/`#1d8a4a`) e sempre acompanhado de nome e raia. Verde não é usado para outros significados no telão (zona além da meta em âmbar).
- **Fatos aritméticos:** o usuário pediu elementos que indiquem fatos relevantes (“2º turno confirmado; Vitória matemática, etc.”). Exibidos somente quando garantidos pelos números publicados para qualquer resultado das seções restantes, com limite conservador (todo eleitor apto restante poderia votar e votar no candidato menos favorável à afirmação; sub judice tratado como possivelmente válido; anulados nunca): vitória matemática no 1º turno (votos > metade dos válidos ainda possíveis), 2º turno confirmado (ninguém pode passar de 50% dos válidos), finalistas definidos (3º não alcança o 2º). Não são previsão nem probabilidade; texto informa que estão sujeitos a retificação e que o resultado é proclamado pelo TSE. Regra 10 permanece para todo o resto.
- **Demonstração:** `/telao?demo` (e `?demo=vitoria`, `&ritmo=ms`) gera apuração sintética no navegador, com nomes genéricos e selo DEMONSTRAÇÃO; nunca persiste nem usa rota oficial.

## Replicação local — para agentes

Siga [docs/REPLICAR.md](docs/REPLICAR.md); não improvise outro caminho. Resumo operacional:

1. `pnpm install --frozen-lockfile && pnpm build && pnpm test` (sem rede). Verifique antes de mudar qualquer coisa.
2. Nível 0 (padrão para desenvolvimento e revisão visual): `pnpm start` e `/telao?demo` ou `/`. Não exige rede nem dados.
3. Nível 1 (coleta oficial): só com pedido explícito do usuário. **Um único coletor TSE por máquina/IP** (`pnpm collect:official:live`); confirme que nenhum outro está rodando (`data/national-benchmark/active.lock`). Nunca rode oficial e simulado juntos. Teto de 80 req/s; prefira taxas menores fora da noite da apuração.
4. Nível 2 (históricos ~951 MB + `pnpm accept:territorial-audit`): só com pedido explícito; o passo de aceite reproduz uma decisão já registrada do usuário e recusa se os hashes não baterem — não contorne.
5. Para outra cópia ao lado de uma em execução, use `ATLAS_API_PORT`/`ATLAS_WEB_PORT` (ex.: `pnpm dev:rework` usa 3101/5273) e nunca reinicie processos de outra pessoa sem pedir.
6. Antes de declarar pronto: `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:e2e` e `pnpm format:check` com **código de saída** verificado (não confiar em `| grep`), mais revisão visual quando houver UI.

### Estado — 04/10/2026, tarde

Telão integrado ao `main` (rotas `/live/<env>/telao`; feed `/zone-feed`; status `/status`), junto com o painel explorador. Tag `v1.0-eleicao-2026` = versão anterior ao telão; `v1.1-telao` = esta. Na noite de 04/10 o telão foi operado a partir de uma segunda cópia (porta 3101) lendo o mesmo acervo oficial; o painel 3001 e o coletor seguiram na versão estável.
