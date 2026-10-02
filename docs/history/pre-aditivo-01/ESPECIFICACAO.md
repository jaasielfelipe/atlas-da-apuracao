# ATLAS DA APURAÇÃO — Especificação funcional e técnica

**Versão:** 1.0 — 02/10/2026  
**Estado:** especificação de implementação inicial  
**Uso:** aplicação local e pessoal; um único usuário; sem contas, login ou hospedagem pública  
**Eleição inicial:** Eleições Gerais do Brasil, **1º turno de 2026 (04/10/2026)**  
**Cargos:** Presidente da República e Governador  
**Idioma:** português do Brasil  
**Fuso de exibição:** `America/Sao_Paulo`; timestamps persistidos em UTC  
**Natureza:** painel estatístico objetivo; não editorial, não preditivo

> **INSTRUÇÃO A QUEM IMPLEMENTAR:** preservar as distinções entre totalização oficial, disponibilidade de boletins, reconstrução histórica e resultados completos de outros anos. Uma interface que confunde essas quatro bases está incorreta, mesmo quando exibe números aritmeticamente plausíveis.

---

## 1. Resumo executivo e objetivo

O **Atlas da Apuração** é um observatório cartográfico da totalização eleitoral, executado no computador do proprietário e acessado em navegador por `localhost`. Sua característica distintiva é a exploração **temporal e histórica**, não a mera divulgação de resultados.

A aplicação organiza três camadas **de igual importância**:

1. **Resultado:** números acumulados divulgados pelo TSE, por eleição, cargo e território.
2. **Cobertura:** quantidade e distribuição das seções, eleitorado e boletins efetivamente abrangidos pelos dados mostrados.
3. **Comparação:** séries temporais e diferenças históricas calculadas para dois agrupamentos analíticos presidenciais em 2018, 2022 e 2026.

A seleção de território, de instante da timeline e de camada deve repercutir nos demais componentes pertinentes, **sem alterar silenciosamente a base estatística**. Apenas dados e metadados objetivos: não criar textos automáticos de diagnóstico, inferências sobre preferências individuais, probabilidades de resultado, prognósticos eleitorais ou rótulos interpretativos.

### 1.1 Objetivos

- Exibir um mapa interativo do Brasil, das UFs e dos municípios, com navegação hierárquica.
- Acompanhar resultados oficiais de Presidente no Brasil e por UF, e de Governador por UF.
- Consultar resultados municipais **somente** de municípios pesquisados e salvos pelo usuário; as informações cadastrais/geográficas podem existir para todos.
- Registrar snapshots imutáveis, inspecionáveis e reproduzíveis do resultado oficial.
- Apresentar métricas temporais: progresso das seções, votos acumulados, participação nos votos válidos, diferenças e incrementos entre snapshots.
- Permitir a comparação presidencial para as séries históricas explicitamente definidas na seção 5.
- Calcular, nos municípios monitorados, comparações históricas com **coortes conciliadas de seções**, quando houver boletins válidos de 2026 e histórico disponível.
- Disponibilizar um modo `replay` e um modo `simulado`, com separação absoluta dos dados oficiais.
- Operar com coleta econômica e tolerante a falhas da CDN do TSE.

### 1.2 Não objetivos do MVP

- Legislativo, apuração proporcional, distribuição de cadeiras ou análise de Senado.
- Apuração por bairro, identificação de residência do eleitor ou inferência individual.
- Previsão de vencedor, probabilidade de vitória, projeções extrapolativas ou “margem de erro” amostral não defensável.
- Diagnósticos políticos, manchetes geradas, recomendações ou textos editoriais.
- Coleta universal de boletins de todas as seções do país.
- Login, registro de usuários, permissões, contas, analytics, cobrança, publicação pública, Docker obrigatório, serviço em nuvem ou banco gerenciado.
- Comparação de governador com anos anteriores no MVP.
- Garantia de acesso offline à fonte oficial (replay dos registros locais, sim).

---

## 2. Princípios de produto e qualidade estatística

**P1 — Acompanhamento é uma sequência.** O estado atual é apenas o último snapshot de uma série; preservar o histórico de alterações recebidas.

**P2 — Resultado, Cobertura e Comparação são pares.** Nenhuma das três é uma seção secundária escondida. Cada camada possui visualizações próprias e escala temporal.

**P3 — Denominadores explícitos.** Todo número percentual revela, em tooltip ou detalhes, numerador, denominador, unidade, território, cargo, turno, data de geração e tipo de dado.

**P4 — Não confundir universos.** O resultado EA20 pode conter mais seções do que a coorte de boletins disponíveis e conciliados; esses percentuais não são comparáveis como se tivessem o mesmo denominador.

**P5 — Comparações históricas condicionadas.** Candidaturas de 2018, 2022 e 2026 são reunidas por convenção analítica *configurada pelo usuário*, e não por afirmação de equivalência dos eleitores.

**P6 — Nenhuma temporalidade inventada.** As curvas de 2018 e 2022 recalculadas a partir da ordem de chegada dos boletins de 2026 são reconstruções, **não** a cronologia original de 2018/2022. Não interpolar observações como se fossem medições.

**P7 — Cobertura não é representatividade.** Fração alta de seções conciliadas não prova uma amostra aleatória nem autoriza inferência causal/comportamental.

**P8 — Ausência não é zero.** `not_loaded`, `not_published`, `unmatched`, `stale`, `error` e `0` são estados distintos.

**P9 — Origem verificável.** Guardar dados brutos, URL de origem, digest, horário da fonte, horário da captura, fase e transformações aplicadas. O usuário deve poder inspecionar a origem de cada métrica.

**P10 — Desenvolvimento orientado por contratos e testes.** Adaptadores separados para EA11, EA12, EA14, EA15, EA16, EA18 e EA20; fixtures reais do simulado de setembro de 2026; nunca assumir schema só pela aparência.

**P11 — Local por padrão.** Vincular API e frontend a `127.0.0.1`; não expor portas à rede; nenhuma autenticação necessária no contexto escolhido.

---

## 3. Fonte oficial e parâmetros verificados em 02/10/2026

Fonte principal: [Página técnica do TSE sobre a divulgação de resultados 2026](https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados).

- Base do ambiente oficial: `https://resultados.tse.jus.br`
- Configuração das eleições (EA11): `https://resultados.tse.jus.br/oficial/comum/config/ele-c.json`
- Primeiro turno de 04/10/2026: pleito **3220**; diretório de ciclo `ele2026`.
- Eleição federal para Presidente: **6257**, cargo **0001**.
- Eleição estadual para Governador: **6259**, cargo **0003**.
- Par `cdt2` do EA11 aponta, respectivamente, para 6258 e 6260, **não** sendo pressuposto que qualquer cargo ou UF terá efetivamente segundo turno.
- Formato do número da eleição no nome do arquivo: seis dígitos (`e006257`, `e006259`), a ser gerado por adaptador.
- Código de município TSE no nome dos arquivos: **cinco caracteres**, com zeros à esquerda. Códigos de zona e seção em caminhos de arquivos de urna: quatro dígitos, quando previsto no documento de download.
- Limite divulgado: **100 requisições/segundo/IP**; exceder pode provocar bloqueio de **10 minutos** e tentativas prematuras podem reiniciar o bloqueio. Muitos 404 podem bloquear o IP sem limiar publicado.
- `ETag` e `Last-Modified` podem reduzir transferência via HTTP 304, mas **304 também consome cota de requisições**.
- Não há frequência fixa garantida de atualização; arquivos relacionados podem chegar à CDN em momentos distintos.
- `idg` é identificador de geração **não sequencial global nem contador monotônico de versões comparáveis**. Não ordenar arquivos distintos por `idg`.
- Registros de simulado `f = "s"` não podem ingressar no banco de produção como resultados reais (`f = "o"`).
- Os exemplos de setembro no ambiente `https://resultados-sim.tse.jus.br/simulado/simulado2026/...` permanecem úteis como fixtures, **não são resultados eleitorais de 2026**.

**URLs públicas de exemplo do simulado:**

```
https://resultados-sim.tse.jus.br/simulado/simulado2026/comum/config/ele-c.json
https://resultados-sim.tse.jus.br/simulado/simulado2026/ele2026/21270/dados/br/br-e021270-ab.json
https://resultados-sim.tse.jus.br/simulado/simulado2026/ele2026/21270/dados/br/br-c0001-e021270-u.json
https://resultados-sim.tse.jus.br/simulado/simulado2026/ele2026/21272/dados/ac/ac-c0003-e021272-u.json
https://resultados-sim.tse.jus.br/simulado/simulado2026/ele2026/21270/config/mun-e021270-cm.json
```

O gerador de URL **deve usar os diretórios `arq[].dir` descobertos no EA11** sempre que aplicável; não fixar a estrutura como conhecimento implícito disperso por componentes. Primeiro implementar e testar uma função única `resolveTsePath(kind, context)`.

### 3.1 Arquivos a consumir

| Tipo | Papel no MVP | Observação |
|---|---|---|
| EA11 (`ele-c.json`) | Descobrir pleito, eleições, cargos e diretórios | Bootstrap e validação de configuração |
| EA12 (configuração de municípios) | Relação de municípios e mapeamento código TSE/IBGE | Alimenta busca e união cartográfica |
| EA14 (acompanhamento Brasil) | Descobrir alterações nas UFs | Índice operacional de atualização; não substituir o EA20 |
| EA15 (acompanhamento UF) | Descobrir alterações municipais nas UFs com favoritos | Economiza consultas municipais |
| EA20 (resultado unificado) | Resultados oficiais agregados por Brasil/UF/município | Fonte de votos e progresso oficial |
| EA16 (configuração das seções) | Lista de seções, principal/agregadas, chegada de arquivos auxiliares | Coleta histórica granular dos municípios salvos |
| EA18 (auxiliar da seção) | Hashes, situação e nomes dos arquivos de urna | Descoberta/identificação dos boletins |
| Arquivo BU | Votos da seção em 2026 | Precisa de decodificador e testes independentes |

**Atenção:** `EA14/EA15` fornecem pistas de atualização. A aplicação deve confirmar a mudança no `EA20` usando metadados e digest antes de publicar novo snapshot. O TSE adverte que os arquivos não são sincronizados atomicamente na CDN.

### 3.2 Estrutura EA20 a tratar

A documentação oficial lista, entre outros, os seguintes campos:

- Raiz: `ele`, `t`, `f`, `tpabr`, `cdabr`, `dg`, `hg`, `idg`, `dt`, `ht`, `and`, `tf`, `dv`, `carg`.
- `carg[].agr[].par[].cand[]`: `n`, `sqcand`, `nm`, `nmu`, `dvt`, `vap`, `pvap`, `pvapn`.
- Seções `s`: `ts`, `st`, `snt` (e subcategorias).
- Eleitorado `e`: `te`, `est`, `esnt`, `c`, `a` (e subcategorias).
- Votos `v`: `tv`, `vvc`, `vv`, `vb`, `tvn`, `van`, `vansj`, etc.

**Regra:** `v.vv` (votos válidos) **não é o mesmo que** `v.vvc` (votos a votáveis), especialmente quando houver destinações judiciais diferenciadas. `cand.vap` são votos computados da candidatura, cujo tratamento depende de `dvt`. Não usar `pvap` como sinônimo automático de votos válidos sem validar sua semântica no cenário. Expor `dvt` e não mascarar votos anulados/sub judice.

### 3.3 Outras fontes estritamente necessárias

1. [Resultados de 2018 por seção](https://dadosabertos.tse.jus.br/dataset/resultados-2018) — presidente, **1º turno**.
2. [Resultados de 2022 por seção](https://dadosabertos.tse.jus.br/dataset/resultados-2022) — presidente, **1º turno**.
3. **Malha municipal do IBGE** (edição estável; preparar GeoJSON simplificado com códigos IBGE) — apenas geometrias.

Não integrar pesquisas eleitorais, financiamento, redes sociais, dados de imprensa ou IBGE de população ao MVP; o próprio EA20 oferece o eleitorado apto para as métricas necessárias.

---

## 4. Comportamento funcional: navegação e interface

### 4.1 Composição de tela

- Barra superior: nome, modo (`Oficial`, `Simulado`, `Replay`), status da conexão, instante da fonte e última captura.
- Controle principal de território: **Brasil → UF → Município**; breadcrumb e busca rápida por município.
- Cargo: `Presidente` / `Governador`. Presidente pode ser consultado em BR, UF e município; Governador exige UF ou município.
- **Três abas/camadas de mesmo peso:** `Resultado | Cobertura | Comparação`. Elas alteram a métrica principal e a composição dos gráficos/legendas sem descartar o recorte.
- Mapa como elemento de maior área visual; painel lateral com métricas; timeline/controle de instantes em área inferior.
- Lista persistente de municípios monitorados (favoritos); ações: `Pesquisar`, `Monitorar`, `Parar de monitorar`, `Selecionar`. Selecionar um município pode oferecer explicitamente monitoramento; **seleção isolada não inicia coleta silenciosamente**.
- Responsivo para laptop; mouse/teclado como uso prioritário; tooltips acessíveis.

### 4.2 Mapa

- Brasil: polígonos das UFs; cor segundo a métrica/legenda escolhida.
- UF: polígonos municipais com limites e busca.
- Município salvo: mostrar métricas oficiais municipais e, quando disponível, comparação granular.
- Município não salvo: aparece no mapa e na busca, mas sem resultado municipal coletado. Estado `Não monitorado`, e **não** `0%`.
- Para Governador, os candidatos/partidos são do recorte UF selecionado; não combinar UFs em uma lista de candidaturas estaduais como se houvesse uma disputa nacional única.
- DF: tratar sua organização geográfica específica; não inventar municípios no DF para preencher um mapa municipal.
- Exterior (`ZZ`) pode entrar na totalização presidencial nacional, mas não é um estado brasileiro cartografável: registrar e não supor que Brasil seja exatamente a soma das 27 UFs.
- Cores não devem presumir orientação política a partir de nomes: usar paleta categórica neutra, consistente por candidatura dentro de cada cargo.
- Legendas sempre apresentam métrica, unidade e universo; valores ausentes em cinza distinto de valores zero.

### 4.3 Timeline: semântica e interação

O controle temporal deverá ter duas escalas disponíveis:

1. **Horário de captura/fonte**: snapshots recebidos pela aplicação; não equivalem a uma medição contínua do voto.
2. **Progresso de seções**: fração de seções oficial/da coorte (identificando qual universo se aplica).

Ao selecionar um instante, selecionar **o último snapshot existente até ele**, nunca interpolar valores entre snapshots. O usuário deve poder retornar a `Agora`, pausar a visualização e reproduzir estados anteriores sem parar a coleta.

Gráficos:

- Linha acumulada da participação nos votos válidos (quando semanticamente válida).
- Linha de votos acumulados (valor inteiro).
- Cobertura de seções/eleitorado, com séries próprias.
- Comparação histórica tripla por agrupamento analítico (ver seção 5).
- Diferença histórica em pontos percentuais, com linha zero.

Nunca afirmar que 2018/2022 foram apurados nos horários de 2026. Os gráficos históricos sincronizados ao eixo de 2026 são **reconstruções por coorte**, assim rotulados.

### 4.4 Estados visuais e operacionais

`Aguardando publicação`, `Atualizando`, `Atualizado`, `Últimos dados em HH:MM:SS`, `Fonte temporariamente indisponível`, `Não monitorado`, `Boletim recebido (não conciliado)`, `Comparação indisponível`, `Replay`, `Simulado`.

Nunca inferir “ao vivo” apenas porque a página está aberta. Mostrar idade do último dado e seu ambiente; datas em horário de Brasília.

---

## 5. Comparação presidencial: regra obrigatória

Estas correspondências foram **definidas pelo proprietário para fins exclusivamente analíticos**, não são classificações político-partidárias nem hipótese de identidade entre eleitores.

| Ano / turno | Série **Bolsonaro** | Série **Lula/Haddad** |
|---|---|---|
| **2018 / 1º** | Jair Bolsonaro | Fernando Haddad |
| **2022 / 1º** | Jair Bolsonaro | Luiz Inácio Lula da Silva |
| **2026 / 1º** | Flávio Bolsonaro | Luiz Inácio Lula da Silva |

Outras candidaturas continuam na camada Resultado oficial, mas **não recebem timelines históricas individuais**. A candidatura de 2026 deve ser vinculada ao identificador (`sqcand`/número) **validado no EA20 oficial**. Até essa validação, a série permanece `candidate_unresolved`, sem atribuir votos por coincidência de nome. A identificação precisa ser configurável, com trilha de auditoria, para lidar com substituições e situações jurídicas.

### 5.1 Dois comparativos com metodologias não intercambiáveis

**MODO A — Referência histórica territorial completa (BR, UF e município, quando aplicável):**

- Resultado oficial parcial de 2026 sobre **as seções contabilizadas até o instante**.
- Resultado histórico **final** do mesmo território em 2018/2022.
- Útil para visualizar referências, mas **não é comparação em coorte equivalente**.
- Título obrigatório: `2026 parcial × histórico final do território`.
- Exibir legenda `coberturas diferentes`, com denominação dos universos. Nunca apresentar suas diferenças como se fossem o comparativo por seções correspondentes.
- O valor histórico final permanece fixo na timeline. Exibir como referência fixa/tracejada, não como curva reconstruída variável.

**MODO B — Coorte histórica de seções de 2026 (para município monitorado):**

- Selecionar seções/unidades de urna de 2026 com BU disponível, parseado e aceitável, conciliáveis com 2018 **e** 2022.
- Recalcular para cada atualização o total de votos válidos e votos associados a cada agrupamento histórico **somente nessa coorte comum**.
- Dentro de cada eleição, a participação resulta da divisão dos votos da candidatura pelos votos válidos **das mesmas seções históricas selecionadas**.
- As três curvas (2018, 2022, 2026) são **calculadas sobre conjuntos geográficos correspondentes, mas não os mesmos indivíduos**.
- Exibir `coorte comum` + quantidade de unidades/eleitores e participação dos votos válidos de 2026 dessa coorte no **universo oficial municipal disponível no mesmo instante** quando este for temporalmente comparável; caso contrário, marcar métrica de cobertura como não reconciliada e usar contagem absoluta.
- Este modo é independente dos snapshots EA20. BU recebido e BU contabilizado pelo EA20 não são sinônimos; não publicar falsa equivalência.

**Prioridade:** o MODO B representa a funcionalidade avançada pretendida, mas requer decodificador BU e teste de conciliação. O MODO A deve ser entregue antes, identificado corretamente, sem bloquear o painel de resultados.

### 5.2 Fórmulas

Para uma coorte comum `S_t` definida pela chegada de novos **BUs processáveis de 2026**:

```
share(series, year, S_t) =
  valid_candidate_votes(series, year, S_t) / valid_votes(year, S_t)
```

Se o denominador for zero, retornar `null` (nunca 0 automaticamente).

As duas séries produzem **quatro diferenças históricas**:

```
delta_bolsonaro_18_pp = 100 * (share(Bolsonaro, 2026, S_t) - share(Bolsonaro, 2018, S_t))
delta_bolsonaro_22_pp = 100 * (share(Bolsonaro, 2026, S_t) - share(Bolsonaro, 2022, S_t))
delta_lulahaddad_18_pp = 100 * (share(LulaHaddad, 2026, S_t) - share(LulaHaddad, 2018, S_t))
delta_lulahaddad_22_pp = 100 * (share(LulaHaddad, 2026, S_t) - share(LulaHaddad, 2022, S_t))
```

Armazenar proporções internamente em `[0, 1]`, calcular diferença em **pontos percentuais** e arredondar apenas na renderização (tipicamente uma casa decimal). Evitar “cresceu 5%” quando o resultado foi de +5 p.p.

**Regra dos conjuntos:** usar exatamente `S_t` comum para todos os seis valores percentuais. Se não houver coorte comum suficiente para uma informação significativa, manter indisponibilidade; não completar lacunas com estimativas. A cobertura é uma quantidade descritiva, **não um limiar probabilístico**.

### 5.3 Conciliação de seções

Chaves normalizadas, sempre strings com padding quando aplicável:

```
{year, round, uf, tse_municipality_code, electoral_zone, electoral_section}
```

Transformar cada urna principal de 2026 em uma unidade de comparação. No EA16:

- `ns`: número da seção.
- `nsp`: seção principal, quando a seção é agregada.
- `nsa`: seções agregadas na principal, quando aplicável.
- `da`/`ha`: datas de geração de auxiliar, **não** prova de totalização.

Tratamentos de conciliação:

| Situação | Status | Inclusão |
|---|---|---|
| Chave exata histórica para mesma UF/município/zona/seção; sem ambiguidade conhecida | `exact` | Sim |
| Principal+agregadas com todas as seções históricas identificadas, sem duplicação | `aggregate_verified` | Sim |
| Faltam seções/denominador/compatibilidade histórica | `missing_or_ambiguous` | Não |
| Suspeita de redistritamento, mudança relevante ou anomalia aritmética | `review` | Não, até validação |

Regras:

1. Nunca contar uma seção histórica duas vezes em uma mesma coorte (restrição UNIQUE por ano/candidatura/unidade histórica).
2. Uma seção agregada em 2026 não pode reaparecer como unidade independente da mesma coorte.
3. As chaves iguais não garantem identidade do eleitorado. O produto mede uma **comparação territorial de seções**, não mudança individual de voto.
4. Guardar mapa de correspondências 2026→2018 e 2026→2022 por unidade e histórico da decisão.
5. Ausência de correspondência em **qualquer** um dos dois anos exclui a unidade da coorte comum; a base bruta 2026 permanece preservada.
6. Guardar quantidade de unidades excluídas e respectivos motivos.

### 5.4 Sincronização com totalização oficial

- **EA16/EA18/BU** comprovam disponibilidade/recebimento de arquivos, de acordo com seu estado e validação; **não** comprovam automaticamente inclusão na totalização EA20.
- Uma coorte de BUs pode estar adiantada ou atrasada em relação aos agregados oficiais.
- Não somar BUs recebidos e exibir o valor como se fosse o total oficial.
- `SnapshotOficial` e `SnapshotCoorteBU` são entidades distintas, cada qual com fonte, instante, cobertura e versões próprias.
- Somente apresentar o estado `reconciliado` quando houver evidência suficiente de igualdade compatível dos totais por cargo/abrangência e alinhamento temporal. Quando não for possível provar que todos os boletins pertencem ao mesmo corte temporal, manter `não reconciliado`.
- A comparação por coorte pode ser exibida mesmo sem reconciliação completa, mas com **título inequívoco** `Boletins disponíveis de 2026 × mesmos agrupamentos históricos` e cobertura própria.

### 5.5 Indicadores objetivos da camada Comparação

| Indicador | Unidade | Universo | Exibição |
|---|---|---|---|
| Participação 2018/2022/2026 da série | % dos válidos | `S_t`, específica para o modo B | 3 curvas por série |
| Diferença 2026 vs 2018 | p.p. | `S_t` | Série e valor selecionado |
| Diferença 2026 vs 2022 | p.p. | `S_t` | Série e valor selecionado |
| Unidades comparáveis | contagem | unidades de urna na coorte comum | sempre visível |
| Unidades sem correspondência | contagem | BUs processáveis fora da coorte | detalhe da cobertura |
| Peso da coorte | % dos votos válidos de 2026 | apenas se numerador e denominador forem temporalmente reconciliáveis | quando validado |
| Instante BU | horário | último BU utilizável | label de origem |
| Instante oficial | horário | último EA20 | label distinto |

Não desenvolver “probabilidade de resultado”, “tendência eleitoral”, “mudança de apoio”, “migração de eleitores”, previsão ou qualquer diagnóstico narrativo.

---

## 6. Catálogo de medidas nas outras camadas

| Camada | Indicador | Fórmula / Fonte | Advertência de semântica |
|---|---|---|---|
| Resultado | Votos computados por candidato | EA20 `cand.vap`, observando `dvt` | Votos computados ≠ sempre votos válidos |
| Resultado | Participação nos votos válidos | votos válidos atribuídos / `v.vv` | validar natureza da destinação e igualdade com a totalização |
| Resultado | Diferença entre candidaturas selecionadas | diferença de inteiros ou participações no **mesmo EA20** | não extrapolar |
| Resultado | Votos válidos, brancos, nulos | EA20 `v` | respeitar categorias oficiais separadas |
| Cobertura | Seções totalizadas | `s.st / s.ts` | porcentagem de seções, não de votos |
| Cobertura | Eleitorado em seções totalizadas | `e.est / e.te` | cobertura cadastral, não comparecimento |
| Cobertura | Comparecimento observado | `e.c / e.esi`, segundo definição EA20 | somente conjunto de seções aplicável |
| Cobertura | Distribuição por UF/município | EA14/EA15/EA20 | município neutro se EA20 municipal não coletado |
| Temporal | Variação no intervalo | snapshot atual − snapshot anterior validado | incremento observado, não mudança individual |
| Temporal | Velocidade de incorporação | ∆ seções / ∆ tempo entre snapshots | não projetar tempo de término |

Validações obrigatórias: `s.st <= s.ts`, `e.est <= e.te` quando comparáveis, `0 <= numerador <= denominador` para percentuais válidos, somas de votos respeitando as definições oficiais e `0` distinto de `null`.

---

## 7. Arquitetura local

### 7.1 Stack recomendada

| Área | Implementação |
|---|---|
| UI | React + TypeScript + Vite |
| Componentes | Tailwind CSS + shadcn/ui |
| Mapa | MapLibre GL JS; geometrias locais GeoJSON simplificadas |
| Gráficos | Apache ECharts |
| API local | Node.js LTS + Fastify + TypeScript |
| Banco | SQLite em WAL (`better-sqlite3`), migrations versionadas |
| Dados e validação | Zod nos limites de ingestão; funções puras no núcleo estatístico |
| Worker | Coletor em processo Node separado ou job gerido pelo Fastify, com **um único scheduler ativo** |
| Atualização UI | Server-Sent Events (SSE) locais; fallback a refetch HTTP |
| Testes | Vitest + fixture tests + Playwright para fluxos críticos |
| Ferramentas de desenvolvimento | `pnpm` workspace; `tsx`; ESLint; Prettier |

Não iniciar com PostgreSQL, Redis, Docker, fila externa, Supabase ou cloud. A fonte externa única em operação normal é o TSE; geometrias e assets preferencialmente locais. O mapa pode usar um style MapLibre minimalista sem tiles de terceiros, priorizando polígonos vetoriais locais.

### 7.2 Topologia

```
[TSE CDN]
  ├── EA11 / EA12 → config e catálogo geográfico
  ├── EA14 / EA15 → detectores de atualização
  ├── EA20        → snapshots oficiais
  └── EA16 / EA18 / BU → coorte granular opcional, somente municípios salvos
                 │
           [Scheduler e adapters]
                 │
      [Validação + normalização + digest]
          ├── SQLite / snapshots
          ├── arquivos brutos compactados
          └── motor estatístico puro
                 │
          [Fastify localhost]
             ├── REST
             └── SSE
                 │
       [React + Mapa + Gráficos]
```

Bind apenas `127.0.0.1` por padrão. Sem senha porque a aplicação é local e privada; não ampliar o binding para `0.0.0.0` inadvertidamente.

### 7.3 Layout de repositório

```
atlas-apuracao/
├── AGENTS.md
├── README.md
├── package.json
├── pnpm-workspace.yaml
├── apps/
│   ├── api/src/{routes,worker,db,services}/
│   └── web/src/{pages,components,features,map,charts}/
├── packages/
│   ├── domain/src/{models,metrics,comparison}/
│   ├── tse/src/{adapters,schemas,url-builder}/
│   └── fixtures/{simulado,synthetic}/
├── scripts/{import-history,prepare-map}/
├── docs/{ESPECIFICACAO,CONTRATOS_E_TESTES}.md
└── data/ (gitignored; criado automaticamente)
    ├── atlas.sqlite
    ├── raw/
    └── maps/
```

Os componentes de UI não devem conhecer o layout cru dos JSON do TSE, nem a lógica de conciliação de seções.

---

## 8. Modelo de dados e persistência

Persistência em banco único `data/atlas.sqlite`. Criar migrations e índices. Sugestão de entidades (pode normalizar mais ou menos, desde que preserve invariantes):

### 8.1 Cadastro

- `election`: `id`, `pleito`, `cycle`, `round`, `scope`, `office`, `phase`, `source_config_digest`.
- `territory`: `id`, `kind` (`BR|UF|MUNICIPALITY|EXTERIOR`), `uf`, `tse_code`, `ibge_code`, `name`, `parent_id`, `geometry_ref`.
- `candidate`: `election_id`, `office`, `sqcand`, `ballot_number`, `display_name`, `party`, `vote_destination`, `active`.
- `series_mapping`: `series_key`, `year`, `round`, `candidate_identity`, `validated_from_source`, `reviewed_at`.
- `watchlist`: `territory_id`, `enabled`, `created_at`, `last_collection_at`, `collect_bu`.

### 8.2 Ingestão e resultados

- `fetch_log`: `request_id`, `environment`, `kind`, `url`, `fetched_at_utc`, `http_status`, `etag`, `last_modified`, `byte_length`, `error_code`, `raw_digest`, `retry_state`.
- `raw_artifact`: `digest`, `kind`, `phase`, `source_url`, `path`, `content_type`, `source_generated_at`, `fetched_at_utc` (dados brutos comprimidos, deduplicados).
- `official_snapshot`: `id`, `environment`, `election_id`, `office`, `territory_id`, `source_generated_at`, `source_totalized_at`, `captured_at_utc`, `source_idg`, `source_digest`, `status`, `sectors_total`, `sectors_totalized`, `voters_total`, `voters_totalized`, `turnout`, `votes_valid`, `votes_blank`, `votes_null`, `raw_artifact_digest`.
- `candidate_snapshot`: `official_snapshot_id`, `candidate_id`, `counted_votes`, `vote_destination`, `valid_votes_share_nullable`.
- `section_2026`: `election_id`, `uf`, `municipality_tse`, `zone`, `section`, `principal_section`, `aggregated_sections_json`, `aux_generation_at`, `aux_status`.
- `bu_artifact`: `unit_key`, `pleito`, `hash`, `raw_digest`, `received_at`, `parsed_at`, `status`, `superseded_by`.
- `bu_vote`: `bu_artifact_id`, `office`, `candidate_identity`, `votes`, `valid_vote_basis`, `legal_status`.

### 8.3 Histórico e coorte

- `historical_section`: `year`, `round`, `uf`, `municipality_tse`, `zone`, `section`, `valid_votes`, `bolsonaro_series_votes`, `lulahaddad_series_votes`, `source_digest`.
- `section_match`: `unit_2026_key`, `historical_year`, `matched_historical_keys_json`, `match_type`, `validation_status`, `reason`, `algorithm_version`.
- `cohort_snapshot`: `id`, `municipality_id`, `as_of_utc`, `units_total_bu`, `units_matched_both_years`, `units_unmatched`, `bu_source_cutoff`, `reconciliation_state`, `algorithm_version`.
- `cohort_year_metrics`: `cohort_snapshot_id`, `year`, `series_key`, `candidate_votes`, `valid_votes`, `share_nullable`.

Restrições:

- `official_snapshot` único por `environment + election_id + office + territory + source_digest`; capturas `304` não criam snapshots duplicados.
- `environment` faz parte de toda chave composta que envolva resultados.
- Nunca sobrescrever snapshots oficiais existentes; revisão de origem gera nova versão.
- `section_match` impede double counting de seção histórica na mesma coorte/ano.
- Preservar integridade na substituição de BU: versões anteriores ficam rastreáveis, mas apenas a versão efetiva validada entra no agregado do momento.
- Não persistir floats arredondados como base de cálculo; guardar contagens inteiras e calcular shares sob demanda com precisão suficiente.

---

## 9. Scheduler, coleta seletiva e confiabilidade

### 9.1 Bootstrap

1. Inicializar e migrar SQLite.
2. Carregar histórico local de watchlist (ou lista vazia).
3. Ler EA11 (ou configuração local verificada) e validar pleito/turno/cargos/fase.
4. Carregar EA12 e mapa de códigos TSE ↔ IBGE; conferir cardinalidades e duplicações.
5. Iniciar polling nacional e por UFs; municipal **somente se salvo**.
6. Enviar eventos SSE após commit transacional dos novos snapshots.
7. Se TSE indisponível, manter interface com último snapshot local e horário visível.

### 9.2 Estratégia de polling — valores **iniciais configuráveis**, não recomendação oficial

- EA14: 8–15 segundos, por eleição/abrangência necessária.
- EA20 Brasil (Presidente): por mudança detectada ou até 10–20 segundos se necessário após validar disponibilidade.
- EA20 UF: atualizar somente os arquivos indicados como potencialmente alterados; varredura de segurança com intervalo maior, escalonada.
- EA15: apenas UFs com municípios monitorados; intervalo 15–30 segundos.
- EA20 municipal: apenas os municípios da watchlist com evidência de alteração; 20–60 segundos se dependente de fallback.
- EA16/EA18/BU: exclusivamente municípios salvos **e** com `collect_bu=true`; inicializar/inspecionar sem inundar a CDN.
- **Teto interno recomendado:** 2–5 requisições HTTP/segundo, concorrência baixa, orçamento único para todos os jobs, com possibilidade de redução automática. Jamais usar o limite oficial de 100/s como meta de operação.
- Aplicar token bucket, priorização (EA11/bootstrap > EA14 > EA20 BR/UF > EA15 > EA20 municipal > BU), backoff exponencial com jitter e pausa em respostas indicativas de bloqueio.
- 404: somente URLs pré-validadas e derivadas de índices; não insistir em endpoints comprovadamente ausentes sem alteração upstream/configuração.
- ETag e If-Modified-Since quando disponíveis; validar schema da resposta antes de salvar.
- Calcular digest canônico do conteúdo; `idg` não é ordenação temporal global.
- Validar regressões inesperadas em contadores como eventos de revisão/correção e nunca sobrescrever silenciosamente valores anteriores.

### 9.3 Watchlist

- Persistida no SQLite. Ao salvar município, validar UF e código TSE, marcar como `requested`; confirmar ingestão antes de mostrar `updated`.
- Município recém-salvo pode começar a coleta depois de a apuração já ter avançado; registrar o histórico de snapshots **a partir de sua inscrição**, não reconstruir artificialmente o que não foi capturado.
- Ao parar monitoramento, preservar dados e permitir replay; parar novas coletas.
- Implementar limite operacional simples de municípios ativos configurável localmente para evitar abuso involuntário.

### 9.4 Integridade de tempo e fonte

Guardar sempre:

- `source_generated_at`: `dg`/`hg` do arquivo.
- `source_totalized_at`: `dt`/`ht` se disponível.
- `captured_at`: relógio local em UTC.
- `display_timezone`: apenas na interface.
- `source_digest` e status de consistência.

Não assumir que timestamps de arquivos distintos definem um snapshot global atômico. Ao filtrar um instante na UI, a regra é usar o último registro **válido de cada feed até o instante** e sinalizar disparidade de atualização quando existir.

---

## 10. API local, eventos e contratos de resposta

Prefixo `/api/v1`. Implementar REST e um único fluxo SSE. Contratos internos TypeScript compartilhados em `packages/domain`.

| Método/rota | Função |
|---|---|
| `GET /health` | `ok`, modo, banco, última captura, versão |
| `GET /api/v1/bootstrap` | parâmetros da eleição, disponíveis e capacidades ativas |
| `GET /api/v1/territories?q=&kind=&uf=` | busca por UF/município |
| `GET /api/v1/watchlist` | municípios salvos e status |
| `POST /api/v1/watchlist` | adicionar município, opcional `collectBu` |
| `DELETE /api/v1/watchlist/:id` | desativar, sem apagar histórico |
| `GET /api/v1/snapshots?office=&territory=&from=&to=` | séries oficiais |
| `GET /api/v1/latest?office=&territory=` | último resultado válido |
| `GET /api/v1/coverage?office=&territory=&at=` | progresso + denominação |
| `GET /api/v1/comparison?territory=&at=&mode=full|cohort` | comparações tipadas e cobertura |
| `GET /api/v1/timeline?office=&territory=&layer=` | snapshots compactos para gráfico |
| `GET /api/v1/sources/:snapshotId` | proveniência, URL, tempos, hashes, fase |
| `GET /api/v1/events` | SSE: `official.updated`, `cohort.updated`, `watchlist.updated`, `source.status` |

Todos os endpoints retornam números inteiros como `number` se não ultrapassarem safe integer do JS; proporções como número decimal em `[0,1]` **ou `null`**. Strings para identificadores eleitorais, inclusive com zeros à esquerda. Retornar `basis` / `universe` / `comparisonMode` sempre que houver porcentagens históricas.

**Exemplo de contrato de comparação por coorte (dados sintéticos):**

```json
{
  "mode": "cohort",
  "environment": "official",
  "office": "president",
  "territory": { "kind": "municipality", "tseCode": "00000", "uf": "xx" },
  "asOf": "2026-10-04T20:00:00Z",
  "basis": "available_bu_common_matched_sections",
  "reconciliation": "not_reconciled",
  "coverage": {
    "buUnitsProcessed": 120,
    "commonMatchedUnits": 110,
    "unmatchedUnits": 10,
    "shareOfOfficialValidVotes": null
  },
  "series": {
    "bolsonaro": {
      "2018": { "candidate": "Jair Bolsonaro", "votes": 1000, "validVotes": 2500, "share": 0.4 },
      "2022": { "candidate": "Jair Bolsonaro", "votes": 1050, "validVotes": 2500, "share": 0.42 },
      "2026": { "candidate": "Flávio Bolsonaro", "votes": 1100, "validVotes": 2500, "share": 0.44 }
    },
    "lula_haddad": {
      "2018": { "candidate": "Fernando Haddad", "votes": 900, "validVotes": 2500, "share": 0.36 },
      "2022": { "candidate": "Lula", "votes": 1000, "validVotes": 2500, "share": 0.4 },
      "2026": { "candidate": "Lula", "votes": 1050, "validVotes": 2500, "share": 0.42 }
    }
  }
}
```

Os valores do exemplo são fabricados e servem exclusivamente para tipagem/contrato. Em implementação, o mesmo denominador anual deve ser consistente entre as duas séries dentro de um ano e da mesma coorte.

---

## 11. Interação, legibilidade e acessibilidade

### 11.1 Convenções numéricas

- Locale `pt-BR`; inteiros com agrupamento (`123.456`), participações com uma casa decimal (`43,2%`) e diferenças em pontos percentuais (`+1,7 p.p.`).
- Tooltips mostram valores originais completos; não truncar contagens de votos nos detalhes.
- Nunca codificar sinal exclusivamente por cor; usar `+`, `−` e rótulo da métrica.
- Dados não disponíveis são `—` + explicação `Não publicado`, `Não monitorado`, `Sem coorte` ou `Fonte indisponível`.
- Escalas do gráfico explícitas; exibir se eixo Y foi aproximado/zoom; nenhuma animação que sugira observações intermediárias inexistentes.
- Distinção de estilo entre `EA20 oficial`, `BU de 2026`, `histórico reconstruído`, `histórico final` e `simulado`.

### 11.2 Interações principais

1. Selecionar Brasil/UF/Município via mapa e busca.
2. Alternar Presidente/Governador; preservar território onde faz sentido.
3. Salvar/remover município para ativar/desativar coleta municipal.
4. Alternar Resultado/Cobertura/Comparação sem perder instante selecionado.
5. Mover timeline/replay ou retornar ao presente.
6. Na Comparação, alternar `Participação (%)` e `Diferença (p.p.)`.
7. Na Comparação, alternar `Coorte por BU` (se disponível) e `Referência histórica final` (com rótulos distintos).
8. Abrir detalhes: seções incluídas/excluídas, denominação, proveniência e status da fonte.

### 11.3 Rótulos permitidos

- `Resultado oficial acumulado`.
- `Seções totalizadas` / `Eleitorado das seções totalizadas`.
- `Boletins disponíveis processados`.
- `Participação nos votos válidos`.
- `Diferença observada (p.p.)`.
- `Histórico final do território — cobertura diferente`.
- `Histórico reconstruído sobre seções conciliadas de 2026`.

Não usar `probabilidade de vitória`, `voto migrado`, `eleitor mudou de lado`, `tendência de vitória`, `liderança consolidada`, `amostra representativa` como rótulos próprios do sistema.

---

## 12. Modo simulado, replay e preparo para o domingo

### 12.1 Isolamento

Exigir `TSE_ENV=official|simulated|fixture`. `official` só aceita URLs da origem oficial aprovada, configuração 2026 confirmada e `f="o"` para publicações de resultado; `simulated` só aceita origem do simulado e `f="s"`. `fixture` não faz chamadas de rede e usa artefatos versionados. Não compartilhar chaves de snapshots entre ambientes.

### 12.2 Replay

O replay lê snapshots locais e reproduz os eventos na ordem **de captura**, exibindo também o horário da fonte. Não inventa dados entre capturas, não reconsulta o TSE e não emite novas atualizações na base de produção.

### 12.3 Validação pré-eleição

- Demonstrar bootstrap com EA11 real disponível antes da eleição.
- Ler e validar EA14/EA20 do ambiente de simulado com resultados não nulos.
- Simular a ordem de chegada de respostas fora de sincronia.
- Verificar mapa, timeline e seleção de município sem rede ao TSE (fixtures locais).
- Importar ao menos um município de 2018 e 2022; medir conciliação por seção com lista de 2026.
- Validar parse de BU de 2026; se não for possível antes do evento, **desabilitar somente o Modo B** por feature flag, sem mascarar o problema.
- Testar execução local sem interface pública e persistência após reinicialização.

---

## 13. Critérios de aceite (MVP)

### Núcleo oficial — obrigatório para entrega operacional

- [ ] Inicia com `pnpm install` + script documentado; vincula a `127.0.0.1`.
- [ ] Nenhum login, serviço cloud ou variáveis de credencial obrigatórias.
- [ ] EA11 é consumido e verificado sem fixar URLs de arquivos inexistentes.
- [ ] Simulado 2026 parseado; oficial/simulado totalmente separados.
- [ ] Presidente Brasil e UFs exibidos a partir de EA20 quando disponíveis.
- [ ] Governador por UF exibido a partir de EA20 quando disponível.
- [ ] Busca de municípios funciona; acompanhamento EA20 municipal apenas após salvar.
- [ ] Mapa mostra municípios não monitorados como sem resultado municipal, nunca zero.
- [ ] Polling adaptativo respeita teto interno e evita loops 404.
- [ ] Snapshots persistem, são deduplicados e sobrevivem a reinício.
- [ ] Resultado, Cobertura e Comparação têm mesmo nível de navegação.
- [ ] Replay funciona e indica fontes e horário.
- [ ] Nenhuma porcentagem sem universo em tooltip/detalhes.
- [ ] Interface preserva estado recente após indisponibilidade do TSE.

### Comparação histórica — entrega incremental

- [ ] Importadores históricos 2018 e 2022 para Presidente/1º turno.
- [ ] Série Bolsonaro: Jair 2018 → Jair 2022 → Flávio 2026.
- [ ] Série Lula/Haddad: Haddad 2018 → Lula 2022 → Lula 2026.
- [ ] Identidades de 2026 resolvidas a partir de fonte oficial validada.
- [ ] Histórico final não é rotulado como coorte equivalente.
- [ ] BU recebido não é rotulado como seção oficialmente totalizada.
- [ ] Coorte comum exclui unidades sem compatibilidade em qualquer ano.
- [ ] Nenhuma seção histórica entra duas vezes no mesmo agregado.
- [ ] Três curvas por série e quatro deltas p.p. calculados por funções puras, testadas.
- [ ] Cobertura da coorte e estados de não reconciliação visíveis.
- [ ] Se o BU de 2026 estiver indisponível, modo coorte mostra indisponibilidade honesta; núcleo continua funcional.

---

## 14. Ordem de desenvolvimento e entregas

**Etapa 0 — Observação de formatos (primeiro):** montar diretório `fixtures/` com EA11 oficial + EA14/EA15/EA20/EA16/EA18 de simulado onde disponíveis; criar schemas mínimos Zod e testes. Provar que URLs construídas correspondem às instruções do TSE. Escrever `CONTRATOS_E_TESTES.md` com descobertas e campos reais.

**Etapa 1 — Vertical slice:** Node+SQLite+endpoint `/latest` alimentado por fixture; React+mapa de UFs, cartão Resultado e atualização simulada; botão Replay.

**Etapa 2 — Coleta oficial:** scheduler, EA14, EA20 Brasil/UF, status, deduplicação, timestamps, modo oficial resiliente.

**Etapa 3 — Monitoramento municipal:** catálogo EA12, malha municipal, busca, watchlist, EA15, EA20 de município salvo, persistência.

**Etapa 4 — Timeline completa oficial:** gráficos acumulados, cobertura, replay, contagens e tempos da fonte; todos os componentes sincronizados ao instante selecionado.

**Etapa 5 — Comparação histórica territorial:** ETL 2018/2022; referências finais estáticas para cada território; mapeamento histórico das duas séries, sem confundir coberturas.

**Etapa 6 — Coorte granular (avanço sujeito à validação):** EA16/EA18/BU, parser, matching e três curvas por série; rótulo de boletins disponíveis e cobertura; testes de regressão.

**Etapa 7 — Estabilidade no dia:** rodar teste de carga local, watchdog, backup SQLite, exportação JSON/CSV de série, validação e monitoramento dos erros/404.

**Critério para seguir à etapa seguinte:** testes da etapa anterior verdes, demonstração em fixture e registro do que está validado/pendente. Um recurso não validado deve ficar desligado, não simular funcionamento.

---

## 15. Riscos e decisões pré-aprovadas

| Risco/limitação | Tratamento decidido |
|---|---|
| EA14/EA15 e EA20 com tempos de publicação diferentes | Metadados por feed; nunca snapshot global fictício |
| Cenários de anulação e sub judice | Preservar destinação de votos e validação do denominador |
| 404s de arquivos BU e bloqueio CDN | Descoberta EA16→EA18; orçamento baixo e backoff |
| Número de seção reaproveitado ou alterado | Comparação limitada a chaves validadas, sem inferência de identidade dos eleitores |
| BU chega antes/depois do EA20 | Curvas BU distintas do resultado oficial, com rótulo persistente |
| Candidatura de 2026 indisponível/não resolvida | Exibir `candidate_unresolved`; não procurar votos por nome aproximado |
| DF, exterior e situações territoriais específicas | Tratamento de geografia explícito; não forçar soma/cartografia incoerente |
| Máquina desligada durante apuração | Perda de snapshots intermediários é admitida; não inventar histórico nem afirmar coleta contínua |
| Mudança do layout TSE | Schemas versionados + fixture tests; interromper componente afetado |
| Prazo curto para 04/10 | Priorizar vertical slice, resultado e timeline; habilitar coorte apenas após validar BU |

---

## 16. Decisões de arquitetura fechadas / a descobrir

### Fechadas

- Um único usuário; local; sem login; sem cloud.
- Primeiro turno de 2026; Executivo (Presidente e Governador).
- Brasil/UF contínuo; municípios EA20 somente sob demanda salvos.
- Três camadas equivalentes: Resultado, Cobertura, Comparação.
- Timeseries oficiais e BU não são fundidas.
- Correspondências históricas Bolsonaro e Lula/Haddad conforme seção 5.
- Sem previsão, probabilidade eleitoral, diagnóstico, narração automática ou inferência de voto individual.
- Stack React/Vite, MapLibre, ECharts, Fastify, SQLite e TypeScript.

### Investigar na etapa 0, sem inventar

- Parsing exato e verificável dos arquivos BU do pleito 2026 (incluindo assinatura, destino do voto e possíveis reenvios).
- Métodos de reconciliação temporal de BU e EA20 quando parcial.
- Cardinalidade e taxa real de conciliação 2018/2022/2026 para município de prova.
- Disponibilidade de URLs reais depois de 17h do dia 04/10 e eventuais mudanças de schema da CDN.
- Definição de corte temporal por BU para evolução incremental em municípios grandes (armazenamento eficiente, intervalos event-driven).

---

## 17. Documentação oficial de consulta

1. TSE, **Informações técnicas sobre a divulgação de resultados 2026** — https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados
2. TSE, **Instruções para download dos arquivos da divulgação — 2026, v1.0** — https://www.tse.jus.br/eleicoes/eleicoes-2026-content/arquivos/divulgacao-de-resultados/tse-instrucoes-para-download-dos-arquivos-da-divulgacao-2026
3. TSE, **EA11 — configuração de eleições** — https://www.tse.jus.br/eleicoes/eleicoes-2026-content/arquivos/divulgacao-de-resultados/tse-ea11-arquivo-de-configuracao-de-eleicoes
4. TSE, **EA12 — configuração de municípios** — https://www.tse.jus.br/eleicoes/eleicoes-2026-content/arquivos/divulgacao-de-resultados/tse-ea12-arquivo-de-configuracao-de-municipios
5. TSE, **EA14 — acompanhamento Brasil** — https://www.tse.jus.br/eleicoes/eleicoes-2026-content/arquivos/divulgacao-de-resultados/tse-ea14-arquivo-de-acompanhamento-brasil
6. TSE, **EA15 — acompanhamento UF** — https://www.tse.jus.br/eleicoes/eleicoes-2026-content/arquivos/divulgacao-de-resultados/tse-ea15-arquivo-de-acompanhamento-uf
7. TSE, **EA16 — configuração de seções eleitorais** — https://www.tse.jus.br/eleicoes/eleicoes-2026-content/arquivos/divulgacao-de-resultados/tse-ea16-arquivo-de-configuracao-de-secoes-eleitorais
8. TSE, **EA18 — auxiliar de seção** — https://www.tse.jus.br/eleicoes/eleicoes-2026-content/arquivos/divulgacao-de-resultados/tse-ea18-arquivo-auxiliar-de-secao
9. TSE, **EA20 — resultado unificado** — https://www.tse.jus.br/eleicoes/eleicoes-2026-content/arquivos/divulgacao-de-resultados/tse-ea20-arquivo-de-resultado-unificado
10. TSE, **Resultados — 2018** — https://dadosabertos.tse.jus.br/dataset/resultados-2018
11. TSE, **Resultados — 2022** — https://dadosabertos.tse.jus.br/dataset/resultados-2022
12. TSE, **Configuração real disponível antes da eleição** — https://resultados.tse.jus.br/oficial/comum/config/ele-c.json
13. MapLibre GL JS, **documentação técnica** — https://maplibre.org/maplibre-gl-js/docs/

**Revisão:** após o primeiro carregamento de dados oficiais reais, registrar quais contratos foram confirmados em produção e quais precisaram ser alterados. Nunca reescrever retroativamente o histórico da especificação sem changelog.
