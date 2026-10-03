# ADITIVO 01 — COMPARAÇÃO POR ZONAS CONCLUÍDAS E TRANSIÇÕES DE LIDERANÇA

**Projeto:** Atlas da Apuração · **Data:** 02/10/2026 · **Versão:** 1.0  
**Status:** decisão funcional que modifica a especificação v1.0  
**Destinatário:** Codex / agente de implementação  
**Âmbito:** apuração presidencial do **primeiro turno** de 2026, comparação com os primeiros turnos de 2018 e 2022.

> **INSTRUÇÃO DE PRECEDÊNCIA:** Este aditivo substitui as regras anteriores que exigiam coletar boletins de urna por seção para produzir a timeline histórica e que limitavam a coorte histórica aos municípios monitorados. As decisões sobre aplicação local/usuário único, stack, dados oficiais, snapshots, mapa, caráter estritamente descritivo e ausência de previsões permanecem vigentes. Não manter dois fluxos históricos concorrentes por descuido de migração.

## 1. Decisão e finalidade

**Coletar resultados de 2026 por município–zona em vez de boletins individuais de todas as seções.** Uma unidade territorial só entra na **coorte comparativa histórica** depois de estar inteiramente totalizada e de possuir correspondência histórica verificável em **ambas** as eleições, 2018 e 2022. Com essa coorte única e crescente, reconstruir as séries de participação, contagem de unidades concluídas e **trocas de liderança territorial** entre eleições.

**Três camadas de mesma importância:** `Resultado`, `Cobertura`, `Comparação`. A timeline é transversal. **Sem diagnósticos, textos interpretativos automáticos, prognósticos ou probabilidade de resultado.** O usuário é único. Não introduzir autenticação ou serviços externos por causa deste aditivo.

As séries definidas **pelo usuário apenas para comparação histórica** são:

| Eleição (1º turno) | Série `bolsonaro` | Série `lula_haddad` |
|---|---|---|
| 2018 | Jair Bolsonaro | Fernando Haddad |
| 2022 | Jair Bolsonaro | Lula |
| 2026 | Flávio Bolsonaro | Lula |

As associações são **convenções analíticas**. Não significam identidade de candidaturas, composição do eleitorado ou transferência individual de votos. Vincular candidatos pelos identificadores oficiais confirmados nos dados, nunca por heurística de nomes. Outras candidaturas devem continuar no cálculo de válidos e na identificação do **primeiro colocado real** em cada unidade; não gerar para elas timelines comparativas próprias.

## 2. Unidades geográficas — diferença fundamental

Existem **duas entidades distintas**:

1. **Unidade mínima de coleta:** `MunicipioZona = {eleicao, turno, uf, codigo_municipio_tse, numero_zona}`. Uma zona eleitoral pode abranger mais de um município; portanto, **município–zona não é necessariamente uma zona eleitoral inteira**.
2. **Zona eleitoral inteira (ZE):** `Zona = {eleicao, turno, uf, numero_zona}`. É a **união de todos os segmentos município–zona daquela zona**, conforme cadastro oficial da eleição. Seu resultado é a **soma dos votos e denominadores dos segmentos constituintes**, sem médias de percentuais.

**Decisão de nomenclatura e escopo:**

- Nos painéis **Brasil** e **UF**, os indicadores solicitados pelo proprietário chamados **“Zonas completas”, “Zonas Lula/Haddad” e “Zonas Bolsonaro”** devem contar **ZEs reais**, `UF + ZE`, **cada uma exatamente uma vez**.
- Uma ZE real somente estará concluída quando **todos** os seus segmentos município–zona de 2026 forem conhecidos, válidos e estiverem 100% totalizados.
- No painel **Município**, usar unidades `município–zona` e rotular expressamente **“Unidades município–zona”**. Não chamar essa contagem de “zonas eleitorais”, pois uma mesma ZE pode abranger outro município. Esse recorte permite continuar oferecendo análise granular dentro do município.
- Ao agregar municípios ou UFs, **nunca somar contagens de ZEs já calculadas por município**: reconstruir a lista distinta de ZEs a partir de seus segmentos (evita dupla contagem).
- `ZZ`/exterior no cargo de Presidente deve ter tratamento territorial explícito: incluir no total oficial nacional; incluir na coorte nacional apenas se for possível representar e conciliar suas unidades sem misturá-las com UFs geográficas. Caso contrário, excluir da coorte e mostrar a cobertura correspondente. Não ocultar silenciosamente.

**Restrição:** chaves de 2018, 2022 e 2026 iguais não provam que a zona tenha mantido as mesmas seções, limites ou perfil de eleitores. Construir `territory_match_status` com `verified`, `uncertain`, `unmatched` e `review`; para a coorte principal usar somente correspondências verificadas no nível territorial escolhido. **Critério inicial de `verified`: correspondência cadastral estrutural**, com UF+número de ZE e conjuntos de códigos de municípios compatíveis entre os três anos, registros completos e sem duplicidades conhecidas, após checagem de eventuais reorganizações documentadas. `verified` **não** significa identidade de seções, eleitores ou limites intramunicipais: mostrar essa ressalva no detalhe metodológico. Exigir auditoria das correspondências; não assumir que apenas a igualdade de UF+número da ZE em anos distintos constitui prova suficiente.

Se o cadastro histórico não permitir validar uma ZE inteira, é aceitável formar **coortes de segmentos município–zona** para uma visualização adicional, mas **não rebatizá-las de “zonas” no painel nacional**. Não substituir a coorte principal por aproximação silenciosa.

## 3. Regra de conclusão e elegibilidade

A coleta de EA20 por zona/segmento deve obter `s.ts`, `s.st`, `s.snt` e os totais presidenciais. Na primeira implementação, validar contra arquivos reais/simulados a abrangência exata do EA20 usado e os estados de finalização.

**Condição operacional conservadora por segmento:**

```ts
completeSegment =
  isOfficial2026FirstRoundPresidential(ea20) &&
  identifiersMatchRequestedTerritory(ea20) &&
  ea20.s.ts > 0 &&
  ea20.s.snt === 0 &&
  ea20.s.st === ea20.s.ts &&
  resultIsInternallyConsistent(ea20);
```

Esta condição deve ser **confirmada com os campos e as exceções do EA20 efetivo**. A apuração admite situações excepcionais (seção não instalada, anulação, retificação, votos com destinação diferenciada). Se contadores apresentarem exceção que exige outra regra oficial, marcar `needs_review` até o adaptador estar validado; **não forçar conclusão por arredondamento de 99,99%**. A indicação `and=f` pode auxiliar a conferência quando aplicável à abrangência, **mas não deve ser assumida como critério suficiente em todos os arquivos zonais** sem teste.

**Conclusão da ZE inteira:**

```ts
completeZone =
  official2026ZoneSegmentRegistryIsComplete(uf, zone) &&
  allExpectedSegments.every(s => s.completeSegment);
```

Uma ZE entra na coorte comum `C(t)` somente se:

1. `completeZone === true` no último conjunto de versões disponíveis até o instante de referência `t`;
2. existem votos e denominadores válidos para 2026;
3. suas unidades territoriais históricas foram conciliadas **sem duplicação nem lacunas** com 2018 e 2022;
4. há resultado presidencial válido e identificadores candidatos verificados para ambos os anos de referência e 2026;
5. as validações de integridade passam.

A coorte comum é **a mesma para todas as seis participações** (duas séries × três anos), assim como para as transições 2018→2026 e 2022→2026 naquele instante. Essa decisão prioriza legibilidade e comparabilidade. Em caso de incompatibilidade em qualquer um dos anos históricos, a ZE não entra na coorte principal e consta nas exclusões/cobertura.

**Cuidado temporal:** usar o **último snapshot válido de cada segmento com horário de captura <= t** para reconstruir a fotografia no tempo; não usar informação obtida depois de `t` em estados anteriores. A coorte normalmente cresce, mas uma correção/retificação pode retirar ou alterar uma unidade: recalcular a fotografia do snapshot; **nunca incrementar contadores cegamente**.

## 4. Definições dos indicadores (obrigatórias)

Todas as contagens abaixo são **inteiros**, sem arredondamento, e se aplicam apenas à coorte `C(t)` elegível e completa. A mudança de escopo Brasil/UF/Município altera `C(t)` de forma explícita; no município, a unidade é município–zona.

### 4.1 Zonas completas

`N_completas(t) = |C(t)|`.

Título na interface nacional/estadual: **“Zonas completas e comparáveis”**. No detalhe exibir separadamente:

- `N_ZE_total_2026`: total de ZEs esperadas, cadastro oficial 2026, no território;
- `N_ZE_concluidas`: total concluído em 2026 **independentemente** da existência de histórico conciliável;
- `N_ZE_comparaveis`: total concluído **e** conciliado com 2018/2022; denominador das distribuições comparativas;
- `N_ZE_incompletas`, `N_ZE_sem_correspondencia`, `N_ZE_pendentes_de_validacao`.

**Nunca mostrar `N_completas/N_total` como “representatividade estatística”**; é cobertura administrativa/territorial.

### 4.2 Zonas em que cada série ficou em primeiro lugar

Calcular o vencedor **de cada unidade e de cada ano** pelo **maior número de votos válidos de candidatura entre todas as candidaturas** daquele ano (pluralidade, sem exigir mais de 50%). Não comparar apenas os dois nomes para declarar o primeiro lugar.

Classificação por ano:

```ts
type Lideranca =
  | 'bolsonaro'
  | 'lula_haddad'
  | 'outros'
  | 'empate'
  | 'indefinido';
```

- `bolsonaro`: a candidatura da série Bolsonaro é a primeira colocada **isoladamente** na unidade;
- `lula_haddad`: a candidatura da série Lula/Haddad é a primeira colocada isoladamente;
- `outros`: outra candidatura é a primeira colocada isoladamente;
- `empate`: empate pela maior votação entre candidaturas, independentemente dos nomes;
- `indefinido`: dado ausente/inconsistente ou votos válidos sem denominador (não confundir com empate ou zero).

Pela construção de `C(t)`, o ideal é que `indefinido` não ocorra: **unidades indefinidas não são elegíveis**, salvo decisão explícita de contabilizar casos separados, sem induzir uma soma incorreta. Empates, se houver, permanecem em categoria própria.

**Contadores para cada um dos três anos sobre exatamente a mesma coorte**:

- `N_bolsonaro(y,t)`;
- `N_lula_haddad(y,t)`;
- `N_outros(y,t)`;
- `N_empates(y,t)`.

**Identidade testável**:

`N_bolsonaro + N_lula_haddad + N_outros + N_empates = N_completas`.

Interface: os destaques de candidatura mostram apenas as duas séries, como solicitado, **mas** exibir um subtotal discreto de `Outros` e `Empates` para explicar eventual diferença entre a soma das duas e o total.

### 4.3 Zonas que mudaram de liderança — principal destaque

Definir uma **matriz de transição** para cada comparação `2018→2026` e `2022→2026` separadamente, sempre para a mesma coorte `C(t)`:

`T[y][a][b] = quantidade de ZEs z em C(t) com Lideranca(z,y)=a e Lideranca(z,2026)=b`.

Categorias de `a` e `b`: `bolsonaro`, `lula_haddad`, `outros`, `empate`. `indefinido` fora da coorte.

**Destaques prioritários (dois sentidos):**

| Rótulo objetivo no painel | Fórmula para ano `y` | Observação |
|---|---|---|
| `Lula/Haddad → Bolsonaro` | `T[y]['lula_haddad']['bolsonaro']` | Zona com liderança histórica da série Lula/Haddad e atual da série Bolsonaro |
| `Bolsonaro → Lula/Haddad` | `T[y]['bolsonaro']['lula_haddad']` | Inverso da categoria anterior |

Os mesmos dois totais podem ser exibidos como **“Bolsonaro: zonas vindas da outra série / zonas que passaram à outra série”** e, respectivamente, para Lula/Haddad, mas **nunca contar duas vezes a mesma troca** em um total de transições.

**Mudanças envolvendo outros candidatos**:

- `outros → bolsonaro`, `bolsonaro → outros`;
- `outros → lula_haddad`, `lula_haddad → outros`;
- `empate ↔ categoria`, se ocorrer, sempre separado das duas trocas diretas.

Essas categorias não devem ser introduzidas como se fossem transições bilaterais entre as duas séries. Manter a matriz completa acessível no detalhamento e, por padrão, destacar apenas as trocas diretas solicitadas.

**Importantíssimo: interpretação do “saldo zero”.** Para a mesma comparação e mesma coorte, **cada unidade tem exatamente uma classificação antes e uma depois**, de modo que a soma das participações em números absolutos de zonas permanece constante. O balanço correto é:

```text
N_X(2026) − N_X(y) = entradas_em_X − saídas_de_X

ΔN_B + ΔN_L + ΔN_Outros + ΔN_Empates = 0

T[L→B] = zonas que B ganhou diretamente de L
        = zonas que L perdeu diretamente para B

T[B→L] = zonas que L ganhou diretamente de B
        = zonas que B perdeu diretamente para L
```

**Não** é verdade que `T[L→B] - T[B→L]` deva dar zero ou próximo de zero. Um dos sentidos pode ter muito mais unidades. A identidade de soma zero se refere aos **saldos líquidos de todas as categorias**, não ao saldo de uma mesma série isoladamente. Mesmo com apenas duas séries e sem terceiros, seus **saldos líquidos são opostos**, não individualmente nulos. Com terceiros/empates, a soma dos saldos das duas séries pode diferir de zero; o saldo completo ainda soma exatamente zero.

**Exemplo sintético, apenas para testar o sistema**:

- Em um conjunto de 10 zonas, 6 eram `B` e 4 eram `L` no ano histórico.
- Entre as eleições, 2 passam de `B→L`, 1 passa de `L→B`, as demais mantêm classificação.
- Atual: `B=5`, `L=5`. Os fluxos são `B→L=2` e `L→B=1` (**não** iguais).
- Os saldos são `ΔB=-1`, `ΔL=+1` e `ΔB+ΔL=0`.

**Nunca chamar troca de liderança de “eleitores que trocaram de voto”**; trata-se de mudança do primeiro colocado agregado em um território entre eleições.

### 4.4 Participações e timeline histórica

Para `C(t)` e `y ∈ {2018,2022,2026}`:

```text
votos_serie(y,t) = Σ_z∈C(t) votos_validos_da_candidatura_serie(y,z)
validos(y,t)     = Σ_z∈C(t) votos_validos_total(y,z)
share(y,t)       = votos_serie(y,t) / validos(y,t), se denominador > 0

delta_pp(2026,y,t) = 100 × (share(2026,t) − share(y,t))
```

Somar **votos**, nunca médias de participações por zona. A timeline de 2018 e 2022 é **recalculada conforme a composição das zonas concluídas em 2026**; **não** reproduz a cronologia original daquelas eleições.

As quatro diferenças continuam sendo: `Bolsonaro 2026−2018`, `Bolsonaro 2026−2022`, `Lula/Haddad 2026−2018`, `Lula/Haddad 2026−2022`, em pontos percentuais.

## 5. Interface — disposição mínima, sem narrativa

Na camada `Comparação`, apresentar na mesma hierarquia visual:

1. **Contagem:** ZEs concluídas em 2026 / ZEs comparáveis / universo total.
2. **Lideranças por zona:** `Bolsonaro`, `Lula/Haddad`, e total residual `Outros / Empates`, no **mesmo conjunto** e para ano histórico selecionado e 2026.
3. **Transições (destaque):** `Bolsonaro→Lula/Haddad` e `Lula/Haddad→Bolsonaro`, com seletor `2018→2026` / `2022→2026`, totais inteiros e possibilidade de detalhar matriz completa.
4. **Timeline:** duas séries de três curvas (2018/2022/2026) ou quatro séries de diferença histórica; adicionalmente, gráfico em degraus da contagem de zonas concluídas e dos dois fluxos diretos de transição.
5. **Cobertura/método:** coorte comum, exclusões e data dos snapshots. Sem índice subjetivo de confiabilidade.

**Rótulos inequívocos**:

- Brasil/UF: `Zonas eleitorais completas` e `Zonas eleitorais comparáveis`;
- Município: `Unidades município–zona completas/comparáveis`;
- Resultados oficiais: `Todas as seções já totalizadas`;
- Comparações: `Somente zonas completas e conciliadas (2018, 2022 e 2026)`;
- Transições: `Mudança de primeiro colocado na zona`, não `mudança de voto`;
- Ausência: `—`, `Pendente`, `Sem correspondência`; zero real = `0`.

As contagens de liderança e de trocas devem ser disponibilizadas em **tabela objetiva**, além dos cartões e gráficos: `{UF, município (se recorte municipal), ZE, líder_2018, líder_2022, líder_2026, votos_validos_por_ano, correspondencia, instante_conclusao}`. O usuário pode ordenar e filtrar.

**Mapa:** preservar geometrias municipais existentes, sem fingir que ZE e município são a mesma divisão. Se futuramente quisermos pintar zonas, será necessária uma malha zonal adequada; por enquanto, o mapa municipal continua recebendo métricas municipais, e as contagens de ZE são apresentadas no painel e em tabelas.

## 6. Coleta, armazenamento e desempenho

**Substituição do caminho crítico anterior:** `EA11 + EA12 + EA14 + EA15 + EA20 (Brasil, UF, município e abrangência zonal validada)`. **EA16/EA18/BU deixam de ser dependências do comparativo histórico do MVP**. Podem ser preservados como módulos experimentais/inativos; não condicionar a entrega a parser de BU.

1. Importar previamente resultados oficiais presidenciais 2018 e 2022 de **votação nominal por município e zona**, 1º turno. Guardar todos os candidatos ou, no mínimo, votos de todos suficientes para apurar o primeiro colocado, votos válidos totais e votos das duas séries. Guardar original e versão transformada.
2. Carregar o cadastro 2026 completo de `(UF, município, zona)` e a relação de segmentos que formam cada ZE. Códigos são strings, com zeros preservados.
3. Coletar continuamente acompanhamento BR/UF e atualizações dos EA20; agora a **coleta zonal deve atingir cobertura nacional progressiva**, não apenas municípios favoritos. Seleções salvas são **prioridade de fila**, não limite de abrangência.
4. Implementar requisições condicionais (`ETag`/`Last-Modified`), deduplicação por digest/território, concorrência limitada, orçamento de requisições, retry com backoff e cuidado especial para 404. A orientação do TSE em 2026 permite **até 100 req/s/IP**, o que é teto, **não meta**. Configurar intensidade e medir latência de ponta a ponta; não prometer tempo real com base somente no teto.
5. Usar EA14 e EA15 como sinais para priorizar novas consultas; **eles não garantem que todos os arquivos zonais relacionados já estejam sincronizados na CDN**. Necessário mecanismo de varredura periódica de zonas pendentes, com cadência/estado por unidade.
6. Persistir cada EA20 atualizado como snapshot imutável e armazenar `captured_at_utc`, timestamp TSE, ambiente, URL, digest e estado de validação; não interpolar valores entre snapshots.
7. Ingestão histórica e processamento de coorte devem ocorrer **localmente** em SQLite, com índices por `election`, `round`, `uf`, `municipality`, `zone`, `candidate_id` e instante. Agregados e matriz de transição podem ser calculados incrementalmente por mudanças e recalculados de forma determinística em replay.
8. A fonte oficial Brasil/UF continua sendo EA20 agregado e **não deve ser substituída automaticamente por uma soma parcial das zonas**. Comparação tem coorte e cobertura próprias, e não deve ser apresentada como apuração oficial do mesmo estágio.

**Capacidade/risco a medir antes de declarar implementação completa:** disponibilidade real de arquivos por unidade zonal em 2026, número de segmentos município–zona existentes, tamanho médio das respostas, atraso até detectar conclusão, tempo para percorrer todas as unidades respeitando limites, consistência entre atualização da zona e município/UF, e percentual de conciliação histórica. Se a latência da cobertura nacional for relevante, mostrar `Último processamento zonal` e `Coleta granular em andamento` sem apresentar valores desatualizados como correntes.

## 7. Modelo mínimo de dados (conceitual)

```ts
type Year = 2018 | 2022 | 2026;
type SeriesKey = 'bolsonaro' | 'lula_haddad';
type Leader = SeriesKey | 'outros' | 'empate' | 'indefinido';

type MunicipalityZoneKey = {
  uf: string;
  tseMunicipality: string;
  zone: string;
};

type WholeZoneKey = { uf: string; zone: string };

type TerritoryMatch = {
  zone2026: WholeZoneKey;
  sourceSegments2026: MunicipalityZoneKey[];
  historicalUnits2018: MunicipalityZoneKey[];
  historicalUnits2022: MunicipalityZoneKey[];
  status: 'verified' | 'uncertain' | 'unmatched' | 'review';
  explanation?: string;
};

type ZoneSnapshot = {
  key: MunicipalityZoneKey;
  capturedAtUtc: string;
  sourceDatetime?: string;
  sourceDigest: string;
  sectionTotal: number;
  sectionCounted: number;
  sectionNotCounted: number;
  validVotes: number;
  votesByCandidate: Record<string, number>;
  status: 'partial' | 'complete' | 'needs_review';
};

type CohortMetric = {
  asOfUtc: string;
  territory: { scope: 'BR' | 'UF' | 'MUNICIPIO'; id: string };
  unitKind: 'whole_zone' | 'municipality_zone';
  comparisonCohortCount: number;
  finalized2026Count: number;
  unmatchedCount: number;
  leaders: Record<Year, Record<Exclude<Leader, 'indefinido'>, number>>;
  transitions2018to2026: Record<string, number>;
  transitions2022to2026: Record<string, number>;
};
```

Implementar a forma final com tabelas normalizadas e chaves primárias adequadas; evitar serializar todo o universo em um único registro JSON imutável. O tipo ilustra sem substituir migrations.

## 8. Testes obrigatórios / critérios de aceite

**A. Validação de fonte**

- Confirmar mediante JSON real/simulado que a chave, a abrangência e os campos `s.ts`, `s.st`, `s.snt`, votos por candidatura e denominação são interpretados corretamente para a unidade zonal.
- Tratar adequadamente `f=s` (simulado), situações jurídicas e exceções de seções não instaladas; não confundir `vv`, `vvc`, `vap` nem `dvt`.
- Um EA20 referente a outro cargo, turno ou território deve falhar no adaptador, sem contaminar a base.

**B. Zona que abrange dois municípios**

- `ZE 005/UF AA` é composta por `M1/005` e `M2/005`; M1 está 100% e M2 em 70%: `ZE completa=false`.
- Quando M2 chega a 100%, `ZE completa=true` e **conta uma única zona** no BR/UF.
- No painel do município M1, a unidade M1/005 pode ser contada como **município–zona**, explicitamente rotulada, sem afirmar que a ZE inteira terminou.

**C. Líder real versus duelo artificial**

- Unidade 2026: candidato `outros` tem 410 votos; série B 400; série L 390 → classificar `outros`, nunca B.
- Empate na primeira posição → `empate`, nunca escolha arbitrária por número/ordem.
- Se votos válidos total = 0 / dados incompletos → fora da coorte, contagem exibida como pendente, sem criar empate.

**D. Trocas e fechamento algébrico**

- Para cada ano histórico e cada instantâneo: soma das quatro classes de liderança = tamanho da coorte.
- Soma de todas as células da matriz 4×4 = tamanho da coorte.
- Somatório dos saldos líquidos de todas as quatro classes = 0, **exatamente**.
- Bilateral `T[B→L]` = ganho de L sobre B = perda de B para L (mesmo evento), sem dupla contagem.
- Simulação com B→L=2 e L→B=1 confirma que **fluxos não precisam se anular**, apesar de `ΔB+ΔL=0` quando não existe classe residual.
- Fluxos `B→outros` ou `outros→L` devem alterar saldo completo sem ser falsamente contabilizados como B↔L.

**E. Timeline / replay**

- Antes de qualquer zona completar, todos os indicadores históricos de participação são `null` e contagens são zero.
- Na primeira zona elegível, seis shares são calculados na mesma coorte, por soma de votos e não por médias de shares zonais.
- Atualização de uma zona **ainda parcial** não altera a coorte nem a matriz de transição.
- Nova ZE completa e conciliada altera as três eleições **simultaneamente** na linha temporal.
- Retificação, retorno de parcialidade ou perda de consistência exige recalcular as contagens; não acumular eventos sem reversão.
- Replay `asOf` não pode enxergar arquivos/snapshots capturados depois do instante escolhido.
- Municípios monitorados prioritariamente não interrompem a coleta de BR/UF nem a expansão zonal nacional.

**F. Apresentação**

- O componente de transição usa rótulos objetivos; não chama diferenças de votos de transferências individuais.
- Mostrar sempre o ano histórico escolhido (`2018→2026` ou `2022→2026`) e a composição da coorte.
- Painel Brasil/UF rotula ZE, painel Município rotula município–zona, inclusive em exportações.
- `Resultado` oficial e `Comparação` por coorte não compartilham silenciosamente o mesmo denominador.

## 9. Mudanças exigidas nos documentos e na implementação preexistente

No repositório, integrar este aditivo sem apagar o histórico documental:

1. Em `docs/ESPECIFICACAO.md`, marcar as seções **1.1, 1.2, 3.1, 4.1–4.4, 5.1 (modo B), 5.2, 5.3, 5.4, 5.5 e todas as partes do coletor/roadmap dependentes de BU** como alteradas por este documento, **nos pontos conflitantes**. Não retirar resultados municipais sob demanda para o nível *oficial*: a mudança é o caráter nacional da coleta *zonal comparativa*.
2. Em `docs/CONTRATOS_E_TESTES.md`, substituir os testes obrigatórios de coorte BU como condição do MVP pelos testes da seção 8 deste aditivo. Um módulo BU pode permanecer como melhoria independente.
3. Em `AGENTS.md`, atualizar o princípio `EA16→EA18→BU para comparação histórica` para `EA20 município–zona / ZE inteira concluída para comparação histórica`. A meta da comparação é cobertura nacional progressiva.
4. Preservar a distinção `official_aggregate` versus `historical_zone_cohort`, e alterar os textos antigos que digam `Boletins disponíveis` para `Zonas concluídas e conciliadas`, **somente nesse modo comparativo**.
5. Adicionar funcionalidades de contagem de zonas concluídas, classificação do primeiro colocado por zona, matriz de transição, mudanças diretas e outros/empates, além de seus testes de invariantes.
6. Informar explicitamente, no relatório de implementação, se a coleta e a reconciliação nacional por zona já foram validadas com dados do ambiente oficial. **Não reportar como concluídas apenas porque passaram nas fixtures.**

## 10. Fontes oficiais e verificações pendentes

1. [TSE — Informações técnicas da divulgação dos resultados das Eleições 2026](https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados): infraestrutura, documentação EA20, indicadores de acompanhamento, sincronização de arquivos, limites e exemplos de simulado.
2. [TSE — Resultados 2018](https://dadosabertos.tse.jus.br/dataset/resultados-2018): votação nominal por município e zona, para reconstruir primeiro colocado e denominador.
3. [TSE — Resultados 2022](https://dadosabertos.tse.jus.br/dataset/resultados-2022): votação nominal por município e zona, para reconstruir primeiro colocado e denominador.
4. [TSE — Conceito de zona eleitoral](https://www.tse.jus.br/comunicacao/noticias/2026/Janeiro/voce-sabe-a-diferenca-entre-secao-e-zona-eleitoral-o-glossario-explica): uma zona pode abranger município inteiro, parte dele ou mais de um município.

**Pontos dependentes de prova técnica pelo Codex:** disponibilidade/caminho EA20 zonal no ambiente de 2026; fórmula de conclusão diante de seções não instaladas/anuladas; construção do registro oficial de segmentos de cada ZE; reconciliação das unidades territoriais entre 2018, 2022 e 2026; tratamento específico do exterior; throughput sob controle de taxa. Se algum desses aspectos não for comprovado, implementar estado explícito `pending_validation`, sem fabricar resultado.

---

**Resumo operacional:** coletar resultados EA20 por município–zona em escala nacional progressiva; completar a ZE inteira somente após todas as suas partes; construir uma coorte comum conciliada com 2018 e 2022; calcular participações, lideranças e matrizes de transição para as duas séries definidas; mostrar contagens e mudanças de liderança diretamente, com invariantes algébricos, sem interpretações nem projeções.

## Registro posterior de decisão do usuário — 03/10/2026

O usuário autorizou considerar realizada a auditoria do estado atual. Para esse cadastro e esses imports, o aceite operacional é registrado como `verified`/`user_accepted_structural` nas ZEs domésticas de composição compatível, com ator, declaração, horário e hashes. Não representa auditoria documental executada pelo agente. Mantêm-se excluídas divergências, ausências e ZZ; continuam obrigatórias a conclusão integral atual, a coorte comum e as demais invariantes. Detalhes em `ESPECIFICACAO.md`, seção 19, e `evidence/national/territorial-user-acceptance.json`.
