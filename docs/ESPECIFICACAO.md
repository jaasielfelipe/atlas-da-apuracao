# ATLAS DA APURAÇÃO — Especificação funcional e técnica

**Versão:** 1.1 — 02/10/2026, integração do Aditivo 01  
**Estado:** especificação vigente; implementação e evidências em [VALIDACAO.md](VALIDACAO.md)  
**Uso:** aplicação local e pessoal; um único usuário; sem contas, login ou hospedagem pública  
**Eleição inicial:** Eleições Gerais do Brasil, **1º turno de 2026 (04/10/2026)**  
**Cargos:** Presidente da República e Governador  
**Idioma:** português do Brasil  
**Fuso de exibição:** `America/Sao_Paulo`; timestamps persistidos em UTC  
**Natureza:** painel estatístico objetivo; não editorial, não preditivo

> **PRECEDÊNCIA:** [ADITIVO_01_COMPARACAO_ZONAS_ATLAS.md](ADITIVO_01_COMPARACAO_ZONAS_ATLAS.md) substitui a comparação obrigatória por boletins individuais e sua limitação aos municípios salvos. Comparação prioritária: zonas completas, contagens de liderança e matrizes de transição territorial. A [v1.0 está preservada](history/pre-aditivo-01/ESPECIFICACAO.md); o histórico das alterações está na seção 18. Esta revisão define requisitos, não declara funcionalidades implementadas.

> **INSTRUÇÃO A QUEM IMPLEMENTAR:** distinguir `official_aggregate`, `historical_zone_cohort` e histórico final territorial. BU disponível permanece uma fonte experimental independente, sem provar totalização oficial e sem ser requisito da coorte zonal. Não fundir bases, horários ou denominadores.

---

## 1. Resumo executivo e objetivo

O **Atlas da Apuração** é um observatório cartográfico da totalização eleitoral, executado no computador do proprietário e acessado em navegador por `localhost`. Sua característica distintiva é a exploração **temporal e histórica**, não a mera divulgação de resultados.

A aplicação organiza três camadas **de igual importância**:

1. **Resultado:** números acumulados divulgados pelo TSE, por eleição, cargo e território.
2. **Cobertura:** quantidade e distribuição de seções, eleitorado, unidades concluídas, conciliadas e excluídas dos dados mostrados.
3. **Comparação:** participações, contagens de liderança e transições territoriais em uma coorte comum de zonas completas em 2018, 2022 e 2026.

A seleção de território, de instante da timeline e de camada deve repercutir nos demais componentes pertinentes, **sem alterar silenciosamente a base estatística**. Apenas dados e metadados objetivos: não criar textos automáticos de diagnóstico, inferências sobre preferências individuais, probabilidades de resultado, prognósticos eleitorais ou rótulos interpretativos.

### 1.1 Objetivos

**Alterado pelo Aditivo 01, §§1–3:** coleta agregada municipal sob demanda permanece; coleta zonal comparativa passa a ter cobertura nacional progressiva.

- Exibir um mapa interativo do Brasil, das UFs e dos municípios, com navegação hierárquica.
- Acompanhar resultados oficiais de Presidente no Brasil e por UF, e de Governador por UF.
- Consultar EA20 **agregado municipal somente** de municípios pesquisados e salvos pelo usuário; as informações cadastrais/geográficas podem existir para todos.
- Registrar snapshots imutáveis, inspecionáveis e reproduzíveis do resultado oficial.
- Apresentar métricas temporais: progresso das seções, votos acumulados, participação nos votos válidos, diferenças e incrementos entre snapshots.
- Permitir a comparação presidencial para as séries históricas explicitamente definidas na seção 5.
- Coletar EA20 município–zona nacionalmente de forma progressiva; favoritos priorizam a fila, sem limitar sua abrangência.
- Calcular a coorte de ZEs inteiras concluídas e conciliadas com **ambos** os anos históricos, contagens de liderança e matrizes `2018→2026` / `2022→2026`; no recorte municipal, contar segmentos município–zona com rótulo explícito.
- Disponibilizar um modo `replay` e um modo `simulado`, com separação absoluta dos dados oficiais.
- Operar com coleta econômica e tolerante a falhas da CDN do TSE.

### 1.2 Não objetivos do MVP

**Alterado pelo Aditivo 01, §§1 e 6:** parser e coleta de BU individuais não condicionam o MVP; cobertura nacional progressiva de EA20 zonal é objetivo.

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

**P4 — Não confundir universos.** O EA20 agregado oficial abrange seções totalizadas, incluindo zonas parciais; a coorte inclui apenas zonas completas e conciliadas nos três anos. Não compartilhar silenciosamente denominadores nem substituir o agregado oficial por soma parcial de zonas.

**P5 — Comparações históricas condicionadas.** Candidaturas de 2018, 2022 e 2026 são reunidas por convenção analítica *configurada pelo usuário*, e não por afirmação de equivalência dos eleitores.

**P6 — Nenhuma temporalidade inventada.** As curvas de 2018 e 2022 são reconstruídas conforme a composição da coorte de zonas completas observada em 2026, **não** a cronologia original de 2018/2022. Não interpolar observações. Retificação pode retirar uma zona; refazer o estado até o instante, sem usar capturas futuras.

**P7 — Cobertura não é representatividade.** Fração alta de zonas conciliadas descreve cobertura administrativa/territorial, não prova amostra aleatória nem autoriza inferência causal/comportamental.

**P8 — Ausência não é zero.** `not_loaded`, `not_published`, `pending_validation`, `needs_review`, `unmatched`, `stale`, `error` e `0` são estados distintos.

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

**Alterado pelo Aditivo 01, §6:** EA20 município–zona integra o caminho crítico; EA16/EA18/BU ficam experimentais e inativos. Schema e caminho zonais ainda exigem prova com arquivo real/simulado.

| Tipo | Papel no MVP | Observação |
|---|---|---|
| EA11 (`ele-c.json`) | Descobrir pleito, eleições, cargos e diretórios | Bootstrap e validação de configuração |
| EA12 (configuração de municípios) | Municípios, códigos TSE/IBGE e relação município–zona | Alimenta busca, mapa e cadastro completo dos segmentos de ZE; comprovar completude |
| EA14 (acompanhamento Brasil) | Descobrir alterações nas UFs | Índice operacional de atualização; não substituir o EA20 |
| EA15 (acompanhamento UF) | Pistas de atualização municipal e priorização zonal nas UFs | Não garante sincronização dos EA20 zonais; combinar com varredura periódica |
| EA20 (resultado unificado) | Agregados Brasil/UF/município e unidade município–zona validada | Votos e progresso por abrangência; não confundir segmento com ZE inteira |
| EA16 / EA18 | Cadastro de seções e descoberta de arquivos de urna | Adaptadores existentes preservados como extensão experimental inativa |
| Arquivo BU | Eventual análise independente de votos por seção | Fora do caminho crítico; decodificador e testes próprios antes de ativar |

**Atenção:** `EA14/EA15` fornecem pistas de atualização. A aplicação deve confirmar a mudança no `EA20` usando metadados e digest antes de publicar novo snapshot. O TSE adverte que os arquivos não são sincronizados atomicamente na CDN.

### 3.2 Estrutura EA20 a tratar

A documentação oficial lista, entre outros, os seguintes campos:

- Raiz: `ele`, `t`, `f`, `tpabr`, `cdabr`, `dg`, `hg`, `idg`, `dt`, `ht`, `and`, `tf`, `dv`, `carg`.
- `carg[].agr[].par[].cand[]`: `n`, `sqcand`, `nm`, `nmu`, `dvt`, `vap`, `pvap`, `pvapn`.
- Seções `s`: `ts`, `st`, `snt` (e subcategorias).
- Eleitorado `e`: `te`, `est`, `esnt`, `c`, `a` (e subcategorias).
- Votos `v`: `tv`, `vvc`, `vv`, `vb`, `tvn`, `van`, `vansj`, etc.

**Regra:** `v.vv` (votos válidos) **não é o mesmo que** `v.vvc` (votos a votáveis), especialmente quando houver destinações judiciais diferenciadas. `cand.vap` são votos computados da candidatura, cujo tratamento depende de `dvt`. Não usar `pvap` como sinônimo automático de votos válidos sem validar sua semântica no cenário. Expor `dvt` e não mascarar votos anulados/sub judice.

Para EA20 município–zona, confirmar em arquivo observado: URL derivada de EA11 e instruções de download, `tpabr`, `cdabr`, vínculo UF/município/zona, cargo, turno, eleição, fase, `ts/st/snt` e destinação dos votos. Não extrapolar o schema municipal para zona. A regra conservadora de conclusão está na seção 5.1; exceções de seções não instaladas/anuladas e retificações exigem validação específica. Até lá: `pending_validation`.

### 3.3 Outras fontes estritamente necessárias

1. [Resultados de 2018](https://dadosabertos.tse.jus.br/dataset/resultados-2018) — votação nominal **por município e zona**, Presidente, **1º turno**.
2. [Resultados de 2022](https://dadosabertos.tse.jus.br/dataset/resultados-2022) — votação nominal **por município e zona**, Presidente, **1º turno**.
3. **Malha municipal do IBGE** (edição estável; preparar GeoJSON simplificado com códigos IBGE) — apenas geometrias.

Não integrar pesquisas eleitorais, financiamento, redes sociais, dados de imprensa ou IBGE de população ao MVP; o próprio EA20 oferece o eleitorado apto para as métricas necessárias.

Os históricos devem preservar votos de todos os candidatos necessários ao primeiro colocado real e ao denominador válido, além das duas séries. Arquivar original, encoding/colunas observados e versão transformada. Códigos territoriais iguais não dispensam conciliação cadastral e auditoria de reorganizações.

---

## 4. Comportamento funcional: navegação e interface

### 4.1 Composição de tela

**Alterado pelo Aditivo 01, §5:** Comparação destaca contagens de ZEs concluídas/comparáveis, lideranças por ano e duas trocas diretas; detalha matriz completa e método. Referência histórica final permanece separada.

- Barra superior: nome, modo (`Oficial`, `Simulado`, `Replay`), status da conexão, instante da fonte e última captura.
- Controle principal de território: **Brasil → UF → Município**; breadcrumb e busca rápida por município.
- Cargo: `Presidente` / `Governador`. Presidente pode ser consultado em BR, UF e município; Governador exige UF ou município.
- **Três abas/camadas de mesmo peso:** `Resultado | Cobertura | Comparação`. Elas alteram a métrica principal e a composição dos gráficos/legendas sem descartar o recorte.
- Mapa como elemento de maior área visual; painel lateral com métricas; timeline/controle de instantes em área inferior.
- Lista persistente de municípios monitorados (favoritos); ações: `Pesquisar`, `Monitorar`, `Parar de monitorar`, `Selecionar`. Salvar inicia coleta agregada municipal e prioriza a fila zonal; seleção isolada não inicia coleta agregada municipal. A coleta zonal nacional independe da lista.
- Responsivo para laptop; mouse/teclado como uso prioritário; tooltips acessíveis.

### 4.2 Mapa

**Alterado pelo Aditivo 01, §§2 e 5:** preservar malhas existentes; município e ZE não são a mesma divisão. Contagens zonais ficam no painel/tabela; pintar ZEs exigiria malha zonal validada, fora desta revisão.

- Brasil: polígonos das UFs; cor segundo a métrica/legenda escolhida.
- UF: polígonos municipais com limites e busca.
- Município salvo: mostrar métricas oficiais municipais e, quando disponível, comparação por unidades município–zona.
- Município não salvo: aparece no mapa e na busca, mas sem resultado EA20 agregado municipal coletado. Estado `Não monitorado`, e **não** `0%`. Comparação município–zona pode existir pela coleta nacional, com sua cobertura própria, sem inventar agregado oficial municipal.
- Para Governador, os candidatos/partidos são do recorte UF selecionado; não combinar UFs em uma lista de candidaturas estaduais como se houvesse uma disputa nacional única.
- DF: tratar sua organização geográfica específica; não inventar municípios no DF para preencher um mapa municipal.
- Exterior (`ZZ`) pode entrar na totalização presidencial nacional, mas não é um estado brasileiro cartografável: registrar e não supor que Brasil seja exatamente a soma das 27 UFs.
- Cores não devem presumir orientação política a partir de nomes: usar paleta categórica neutra, consistente por candidatura dentro de cada cargo.
- Legendas sempre apresentam métrica, unidade e universo; valores ausentes em cinza distinto de valores zero.
- O mapa municipal recebe métricas municipais; uma ZE que abrange dois municípios nunca é desenhada como se fosse um único município. `ZZ` entra na coorte apenas quando representável e conciliado separadamente das UFs geográficas; caso contrário, mostrar exclusão e cobertura.

### 4.3 Timeline: semântica e interação

**Alterado pelo Aditivo 01, §§3–5:** reconstruir coorte e matrizes por versões capturadas até o instante; contagens zonais usam degraus entre estados observados, sem suavização ou valores interpolados.

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
- Contagens de ZEs concluídas/comparáveis e dos dois fluxos diretos, com seletor `2018→2026` / `2022→2026`, sempre sobre a mesma coorte do instante.

Nunca afirmar que 2018/2022 foram apurados nos horários de 2026. Os gráficos históricos sincronizados ao eixo de 2026 são **reconstruções por coorte**, assim rotulados.

### 4.4 Estados visuais e operacionais

**Alterado pelo Aditivo 01, §§5–6:** a comparação não usa disponibilidade de BU como estado de prontidão.

`Aguardando publicação`, `Atualizando`, `Atualizado`, `Últimos dados em HH:MM:SS`, `Fonte temporariamente indisponível`, `Não monitorado`, `Pendente de validação`, `Sem correspondência`, `Coleta granular em andamento`, `Último processamento zonal`, `Comparação indisponível`, `Replay`, `Simulado`, `Fixture`.

Nunca inferir “ao vivo” apenas porque a página está aberta. Mostrar idade do último dado e seu ambiente; datas em horário de Brasília.

---

## 5. Comparação presidencial: regra obrigatória

Estas correspondências foram **definidas pelo proprietário para fins exclusivamente analíticos**, não são classificações político-partidárias nem hipótese de identidade entre eleitores.

| Ano / turno | Série **Bolsonaro** | Série **Lula/Haddad** |
|---|---|---|
| **2018 / 1º** | Jair Bolsonaro | Fernando Haddad |
| **2022 / 1º** | Jair Bolsonaro | Luiz Inácio Lula da Silva |
| **2026 / 1º** | Flávio Bolsonaro | Luiz Inácio Lula da Silva |

Todas as candidaturas entram na apuração de votos válidos e do primeiro colocado real; apenas as duas séries recebem timelines históricas individuais. Vincular cada série ao identificador oficial confirmado em cada ano, nunca por nome aproximado. Em 2026, confirmar `sqcand`/número no EA20 oficial; até lá, `candidate_unresolved`. Versionar associações e decisões sobre substituições/destinação jurídica.

### 5.1 Dois comparativos com metodologias não intercambiáveis

**MODO A — Referência histórica territorial completa (preservado):**

- Resultado oficial parcial de 2026 sobre as seções contabilizadas até o instante, ao lado do resultado histórico **final** do mesmo território em 2018/2022.
- Título: `2026 parcial × histórico final do território`; legenda `coberturas diferentes`. Não é coorte equivalente.
- Valor histórico fixo na timeline, como referência fixa/tracejada. Não simular curva variável nem condicionar o modo B à entrega prévia desse modo.

**MODO B — Zonas concluídas e conciliadas (substituído pelo Aditivo 01, §§2–3):**

- Unidade mínima de coleta: `{election, round, uf, municipality_tse, zone}`; ZE inteira: `{election, round, uf, zone}`. Identificadores strings.
- Em **Brasil/UF**, contar cada ZE real uma vez, unindo **todos** os seus segmentos município–zona esperados no cadastro oficial completo. Somar votos e denominadores; nunca somar contagens municipais de ZEs nem fazer média de percentuais.
- Em **Município**, contar segmentos com o rótulo **Unidades município–zona completas/comparáveis**. O segmento pode concluir antes da ZE inteira.
- Coleta zonal nacional progressiva. Favoritos priorizam a fila, não definem o universo da coorte.

Condição conservadora para cada segmento, **a validar com EA20 zonal real/simulado**:

```ts
completeSegment =
  isOfficial2026FirstRoundPresidential(ea20) &&
  identifiersMatchRequestedTerritory(ea20) &&
  ea20.s.ts > 0 &&
  ea20.s.snt === 0 &&
  ea20.s.st === ea20.s.ts &&
  resultIsInternallyConsistent(ea20);

completeZone =
  official2026ZoneSegmentRegistryIsComplete(uf, zone) &&
  allExpectedSegments.every(segment => segment.completeSegment);
```

Ambientes `simulated` e `fixture` exercitam a regra em namespaces próprios, sem satisfazer validação **oficial** nem se apresentar como tal. Rejeitar cargo/turno/fase/eleição/abrangência/território incompatíveis. Não aceitar 99,99% arredondado como conclusão nem `and=f` isoladamente. Exceções não instaladas/anuladas, contagens incoerentes ou destinação jurídica sem semântica validada ficam `needs_review`.

A coorte `C(t)` exige conclusão, votos/denominadores válidos, candidaturas resolvidas, correspondência territorial `verified` com **2018 e 2022**, sem lacunas ou duplicidade e com integridade nos três anos. É **a mesma** para seis shares, contagens de liderança e ambas as matrizes. Uma ZE sem correspondência em um dos anos fica excluída de todos esses indicadores, com motivo preservado.

Reconstruir usando a última versão efetiva de cada segmento capturada até `t` e versões de cadastro, histórico, mapeamento e decisões disponíveis até esse instante. Resposta rejeitada não é resultado válido; uma retificação reconhecida que torna a unidade parcial/inconsistente deve retirar sua elegibilidade, sem manter o último estado completo como se ainda fosse atual. A coorte normalmente cresce, mas pode diminuir; recalcular deterministicamente.

**Prioridade:** zonas completas, lideranças e transições são o comparativo principal. Validação de EA20 zonal, cadastro, históricos e identidades é condição para habilitar resultados; decodificador BU não é dependência. Núcleo oficial e referências disponíveis continuam funcionando quando o modo B estiver `pending_validation`.

### 5.2 Fórmulas, lideranças e transições

**Substituído pelo Aditivo 01, §4.** Para a mesma coorte `C(t)` e `y ∈ {2018, 2022, 2026}`:

```text
votos_serie(y,t) = Σ_z∈C(t) votos_validos_da_candidatura_serie(y,z)
validos(y,t)     = Σ_z∈C(t) votos_validos_total(y,z)
share(y,t)       = votos_serie(y,t) / validos(y,t), se validos(y,t) > 0
delta_pp(2026,y,t) = 100 * (share(2026,t) - share(y,t))
```

Nunca fazer média de shares zonais. Armazenar inteiros e proporções em `[0,1]`; arredondar apenas na renderização. Os quatro deltas são Bolsonaro 2026−2018/2022 e Lula/Haddad 2026−2018/2022. Sem coorte, shares/deltas são `null` e contagens calculáveis são `0`; fonte ainda não validada/indisponível produz estado específico, não zero fabricado.

Primeiro colocado: maior votação válida **entre todas as candidaturas**, sem exigir mais de 50%. Classificar cada unidade/ano em:

- `bolsonaro` ou `lula_haddad`: candidatura da série isoladamente em primeiro;
- `outros`: outra candidatura isoladamente em primeiro;
- `empate`: duas ou mais candidaturas com a maior votação;
- `indefinido`: dados incompletos/inconsistentes ou denominador zero/ausente. Excluir da coorte principal; não tratar como empate.

Para cada ano, `N_B + N_L + N_Outros + N_Empates = |C(t)|`.

Matrizes **4×4** separadas, para `y=2018` e `y=2022`:

```text
T[y][a][b] = quantidade de unidades em C(t) com líder histórico a e líder 2026 b
a,b ∈ {bolsonaro, lula_haddad, outros, empate}

Σ_a,b T[y][a][b] = |C(t)|
Σ_b T[y][a][b] = N_a(y)
Σ_a T[y][a][b] = N_b(2026)
N_X(2026) - N_X(y) = entradas_X - saídas_X
ΔN_B + ΔN_L + ΔN_Outros + ΔN_Empates = 0
```

Destaques: `Lula/Haddad → Bolsonaro` e `Bolsonaro → Lula/Haddad`. Cada célula é um único evento; ganho de uma série sobre a outra e perda da outra para a primeira são duas descrições do mesmo evento, sem duplicar contagens. Diagonal representa manutenção de liderança; outros/empates permanecem nas células próprias.

**Não exigir igualdade dos dois fluxos diretos.** Fixture: 10 ZEs, histórico B=6/L=4, B→L=2 e L→B=1; atual B=5/L=5, saldos −1/+1. Com terceiros/empates, até a soma dos saldos das duas séries pode não ser zero; a soma das **quatro classes** sempre é zero. Trata-se de **mudança de primeiro colocado na zona**, sem inferência de transferência individual de votos.

### 5.3 Conciliação territorial de zonas

**Substituído pelo Aditivo 01, §2.** Importar votação nominal por município e zona de 2018/2022, primeiro turno presidencial, com todos os candidatos para votos válidos e liderança.

| Status territorial | Evidência | Entra na coorte principal? |
|---|---|---|
| `verified` | Correspondência cadastral estrutural: UF+ZE, conjuntos de municípios compatíveis nos três anos, registros completos, sem duplicidades, checagem de reorganizações documentadas e auditoria | Sim, se demais critérios passarem |
| `uncertain` | Há chaves candidatas, mas compatibilidade não demonstrada | Não |
| `unmatched` | Não há correspondência em pelo menos um ano | Não |
| `review` | Reorganização, duplicidade, conflito ou anomalia requer decisão | Não |

Igualdade de UF+número de ZE **não basta**. `verified` não significa identidade de seções, eleitores ou limites intramunicipais; mostrar essa ressalva no método. Preservar versões dos mapas 2026→2018/2022, segmentos constituintes, fontes, digest, justificativa, algoritmo e instante da decisão. Uma unidade histórica não entra duas vezes em uma coorte/ano.

Se não for possível verificar ZE inteira, permitir apenas uma **visualização adicional explicitamente rotulada município–zona**, sem substituir a coorte principal Brasil/UF. Exterior (`ZZ`) permanece no agregado presidencial nacional oficial; a coorte o inclui somente quando representável e conciliado separadamente das UFs geográficas, ou o exclui com motivo/cobertura visíveis.

### 5.4 Relação com totalização oficial

**Substituído pelo Aditivo 01, §§3 e 6.**

- `official_aggregate`: EA20 agregado Brasil/UF/município, com todas as seções já totalizadas daquele resultado.
- `historical_zone_cohort`: somente zonas completas e conciliadas (2018, 2022 e 2026), com fonte, instantes, versões e cobertura próprios.
- EA14/EA15/EA20 não são publicados atomicamente. Não substituir resultado oficial BR/UF por soma parcial de zonas nem apresentar as duas bases como o mesmo estágio de apuração.
- Mostrar título `Zonas concluídas e conciliadas`, captura/fonte por componente, última coleta/processamento zonal e defasagens. Relação com votos válidos do agregado oficial só é calculável se os cortes forem comprovadamente compatíveis; do contrário, `null` com justificativa.
- Coorte territorial verificada não equivale a sincronização global da CDN. Disponibilidade de BU continua sem provar totalização, em sua eventual extensão experimental independente.

### 5.5 Indicadores objetivos da camada Comparação

**Substituído pelo Aditivo 01, §§4–5.**

| Indicador | Unidade/universo | Exibição |
|---|---|---|
| Total esperado em 2026 | ZEs distintas do cadastro completo no BR/UF; segmentos no município | Total e versão cadastral |
| Concluídas em 2026 | Todas as unidades concluídas, com ou sem histórico conciliável | Separado de comparáveis |
| Completas e comparáveis | `|C(t)|`, concluídas e verificadas em ambos os históricos | Destaque e denominador das distribuições |
| Incompletas, sem correspondência, pendentes de validação | Contagens e motivos no recorte, sem somar categorias sobrepostas | Detalhe da cobertura; desconhecido não vira zero |
| Lideranças por ano | B, L, Outros e Empates, na mesma `C(t)` | Histórico selecionado e 2026; quatro classes fecham o total |
| Trocas diretas nos dois sentidos | Células B→L e L→B | Destaque, seletor 2018→2026 / 2022→2026 |
| Matriz completa e saldos | 16 células, quatro classes, na mesma coorte | Detalhe, incluindo manutenção, outros e empates |
| Participações e quatro deltas | Seis shares e quatro diferenças p.p. sobre `C(t)` | Três curvas por série ou diferenças |
| Timeline de contagens | Concluídas/comparáveis e dois fluxos diretos | Degraus por estados observados, com reversão por correção |
| Fonte e processamento | Horários TSE, captura e último processamento zonal | Distintos do instante do agregado oficial |

Rótulos: Brasil/UF **Zonas eleitorais completas / Zonas eleitorais comparáveis**; Município **Unidades município–zona completas/comparáveis**, inclusive em exportações. O destaque `Zonas completas e comparáveis` refere-se a `|C(t)|`, não a todas as concluídas de 2026.

Tabela ordenável e filtrável: `{UF, município (no recorte municipal), ZE, líder_2018, líder_2022, líder_2026, votos_validos_por_ano, correspondencia, instante_conclusao}`. O instante de conclusão deve ser identificado como observado pela coleta, com os horários de origem separados; não inventar hora exata anterior à captura. BR/UF contam ZE uma vez, inclusive quando há vários municípios constituintes.

Mostrar método, composição da coorte, exclusões e datas. Ausência: `—`, `Pendente`, `Sem correspondência`; zero real: `0`. Não desenvolver probabilidades, previsões, diagnósticos narrativos, índice subjetivo de confiança ou inferências individuais.
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

**Alterado pelo Aditivo 01, §6:** mesma stack local, com EA20 zonal e histórico municipal/zonal no motor comparativo. BU permanece fora do fluxo crítico.

```
[TSE CDN]
  ├── EA11 / EA12 → config e catálogo geográfico
  ├── EA14 / EA15 → detectores de atualização
  ├── EA20 BR/UF/município → snapshots agregados (município salvo)
  ├── EA20 município–zona → snapshots zonais, cobertura nacional progressiva
  └── Histórico 2018/2022 por município–zona → importação local versionada
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

Os componentes de UI não devem conhecer o layout cru dos JSON do TSE, nem a lógica de conciliação territorial de zonas. Adaptadores EA16/EA18 existentes podem ser preservados e testados como módulos experimentais inativos.

---

## 8. Modelo de dados e persistência

Persistência em banco único `data/atlas.sqlite`. **Alterado pelo Aditivo 01, §§6–7:** criar migrations e índices locais para segmentos, ZEs, históricos, correspondências e métricas. O esquema abaixo é o **contrato alvo**, não uma declaração de migrations já implementadas. Preservar snapshots/brutos/watchlist existentes. Não serializar todo o universo zonal em um único registro JSON imutável; armazenar entidades e membros em tabelas normalizadas.

### 8.1 Cadastro

- `election`: `id`, `pleito`, `cycle`, `round`, `scope`, `office`, `phase`, `source_config_digest`.
- `territory`: `id`, `kind` (`BR|UF|MUNICIPALITY|EXTERIOR`), `uf`, `tse_code`, `ibge_code`, `name`, `parent_id`, `geometry_ref`.
- `candidate`: `election_id`, `office`, `sqcand`, `ballot_number`, `display_name`, `party`, `vote_destination`, `active`.
- `series_mapping`: `series_key`, `year`, `round`, `candidate_identity`, `validated_from_source`, `reviewed_at`.
- `watchlist`: `territory_id`, `enabled`, `created_at`, `last_collection_at`; também determina prioridade na fila zonal. Campo legado `collect_bu=false` pode ser mantido por compatibilidade, sem habilitar comparação por BU.
- `zone_registry_version`: ambiente, eleição, turno, fonte/digest, captura, completude e estado de validação.
- `zone_registry_segment`: versão cadastral + UF + município TSE + zona (PK composta); referência à ZE por versão + UF + zona. Manter lista completa de segmentos esperados e o estado do cadastro por ZE.

### 8.2 Ingestão e resultados

- `fetch_log`: `request_id`, `environment`, `kind`, `url`, `fetched_at_utc`, `http_status`, `etag`, `last_modified`, `byte_length`, `error_code`, `raw_digest`, `retry_state`.
- `raw_artifact`: `digest`, `kind`, `phase`, `source_url`, `path`, `content_type`, `source_generated_at`, `fetched_at_utc` (dados brutos comprimidos, deduplicados).
- `official_snapshot`: `id`, `environment`, `election_id`, `office`, `territory_id`, `source_generated_at`, `source_totalized_at`, `captured_at_utc`, `source_idg`, `source_digest`, `status`, `sectors_total`, `sectors_totalized`, `voters_total`, `voters_totalized`, `turnout`, `votes_valid`, `votes_blank`, `votes_null`, `raw_artifact_digest`.
- `candidate_snapshot`: `official_snapshot_id`, `candidate_id`, `counted_votes`, `vote_destination`, `valid_votes_share_nullable`.
- `zone_segment_snapshot`: ambiente, eleição, turno, cargo, UF, município TSE, zona, captura UTC, horários da fonte, URL, digest bruto/canônico, `ts/st/snt`, votos válidos, `partial|complete|needs_review`, versão da validação e motivo. PK por snapshot; unicidade por unidade/ambiente/versão da fonte.
- `zone_candidate_vote`: PK snapshot + identificador de candidatura; votos computados, destinação e votos válidos normalizados quando definidos. Guardar **todos** os candidatos necessários ao primeiro colocado real.
- `zone_collection_state`: uma linha por ambiente/eleição/turno/UF/município/zona, prioridade, próxima consulta, última resposta, ETag, Last-Modified, backoff e motivo de suspensão. Estado operacional pode mudar; snapshots permanecem imutáveis.
- Entidades BU/seções, se já existentes, ficam experimentais e inativas, independentes da comparação por zonas; não exigir novas tabelas BU nesta entrega.

### 8.3 Histórico e coorte

- `historical_import`: ano/eleição/turno/cargo, fonte/digest original, encoding, versão da transformação, captura/importação UTC e validação.
- `historical_zone_unit`: PK importação + UF + município TSE + zona; denominador de votos válidos e integridade cadastral.
- `historical_candidate_vote`: PK unidade histórica + candidatura; votos e destinação, com consolidação explícita de linhas da origem antes de impor unicidade.
- `territory_match`: versão, nível (`whole_zone|municipality_zone`), unidade 2026, status (`verified|uncertain|unmatched|review`), motivo, evidência de reorganização, algoritmo e instante de decisão.
- `territory_match_member`: correspondência + ano + unidade/segmento de origem; impedir reutilização da mesma unidade histórica em duas ZEs da mesma coorte/ano.
- `cohort_snapshot`: id, ambiente, território, `unit_kind`, `as_of_utc`, `basis=historical_zone_cohort`, versões de cadastro/históricos/mapeamento/algoritmo e contagens de cobertura. Guardar instante do processamento separado do corte de captura.
- `cohort_member`: PK coorte + unidade 2026; referências às versões de segmentos, correspondência e resultados anuais efetivos. `cohort_exclusion` registra unidade/motivo, sem fabricar membros ausentes.
- `cohort_year_metrics`: coorte + ano + série (PK), votos da candidatura, votos válidos, share nullable.
- `cohort_leadership`: coorte + ano + classe (PK), contagem inteira.
- `cohort_transition`: coorte + ano histórico + classe de origem + classe de destino (PK), contagem inteira; duas matrizes 4×4, incluindo zeros reais.

Restrições:

- `official_snapshot` único por `environment + election_id + office + territory + source_digest`; capturas `304` não criam snapshots duplicados.
- `environment` faz parte de toda chave composta que envolva resultados.
- Nunca sobrescrever snapshots oficiais existentes; revisão de origem gera nova versão.
- Impedir double counting de segmentos, ZEs e unidades históricas no recorte; municípios de uma mesma ZE nunca geram múltiplas ZEs Brasil/UF.
- Índices por ambiente, eleição/ano, turno, UF, município, zona, candidatura e captura; consulta `asOf` seleciona versões até o corte. Preservar correções e decisões anteriores, incluindo alterações de elegibilidade.
- Materializações incrementais devem corresponder à recomputação determinística; mudança de completude, destinação ou match pode retirar/alterar membro e reverter contagens.
- Não persistir floats arredondados como base de cálculo; guardar contagens inteiras e calcular shares sob demanda com precisão suficiente.

---

## 9. Scheduler, coleta agregada seletiva e cobertura zonal nacional

**Alterado pelo Aditivo 01, §6:** agregado municipal continua limitado aos salvos; fila zonal avança nacionalmente, com prioridade dos favoritos. Um scheduler e um orçamento global, sem infraestrutura adicional.

### 9.1 Bootstrap

1. Inicializar e migrar SQLite.
2. Carregar histórico local de watchlist (ou lista vazia).
3. Ler EA11 (ou configuração local verificada) e validar pleito/turno/cargos/fase.
4. Carregar EA12 e mapa TSE ↔ IBGE; conferir cardinalidades/duplicações e construir cadastro completo de segmentos e ZEs. Importar históricos 2018/2022 e correspondências com versões auditáveis.
5. Iniciar polling BR/UF e agregado municipal **somente se salvo**; iniciar expansão zonal nacional somente após validar o adaptador e cadastro, independentemente dos favoritos.
6. Enviar eventos SSE após commit transacional dos novos snapshots.
7. Se TSE indisponível, manter interface com último snapshot local e horário visível.

### 9.2 Estratégia de polling — valores **iniciais configuráveis**, não recomendação oficial

- EA14: 8–15 segundos, por eleição/abrangência necessária.
- EA20 Brasil (Presidente): por mudança detectada ou até 10–20 segundos se necessário após validar disponibilidade.
- EA20 UF: atualizar somente os arquivos indicados como potencialmente alterados; varredura de segurança com intervalo maior, escalonada.
- EA15: UFs atendidas pela expansão zonal e/ou com municípios monitorados, sob orçamento global; 15–30 segundos como ponto inicial, escalonando conforme capacidade medida.
- EA20 municipal: apenas os municípios da watchlist com evidência de alteração; 20–60 segundos se dependente de fallback.
- EA20 município–zona: fila nacional progressiva com prioridade dos favoritos e pistas EA14/EA15; varredura periódica das unidades pendentes mesmo sem novo sinal. Estado/cadência por unidade; evitar que favoritos impeçam avanço das demais.
- EA16/EA18/BU: experimental e inativo; não reservar orçamento nem criar dependência no comparativo zonal.
- **Teto interno recomendado:** 2–5 requisições HTTP/segundo, concorrência baixa, orçamento único para todos os jobs, com possibilidade de redução automática. Jamais usar o limite oficial de 100/s como meta de operação.
- Aplicar token bucket e concorrência baixa; priorizar bootstrap e continuidade BR/UF, balanceando EA15, municipais salvos e fila zonal (favoritos primeiro, avanço nacional garantido). Backoff exponencial com jitter e pausa em respostas indicativas de bloqueio.
- 404: somente URLs pré-validadas e derivadas de índices; não insistir em endpoints comprovadamente ausentes sem alteração upstream/configuração.
- ETag e If-Modified-Since quando disponíveis; validar schema da resposta antes de salvar.
- Calcular digest canônico do conteúdo; `idg` não é ordenação temporal global.
- Validar regressões inesperadas em contadores como eventos de revisão/correção e nunca sobrescrever silenciosamente valores anteriores.
- Medir quantidade de segmentos, bytes médios, requisições (incluindo 304), tempo de varredura, atraso de detecção de conclusão, defasagem zona/município/UF e cobertura histórica. Intensidade configurável, teto TSE não é meta. Mostrar `Último processamento zonal` e `Coleta granular em andamento`; não prometer tempo real sem evidência de latência.

### 9.3 Watchlist

- Persistida no SQLite. Ao salvar município, validar UF e código TSE, marcar como `requested`; confirmar ingestão antes de mostrar `updated`.
- Município recém-salvo pode começar a coleta depois de a apuração já ter avançado; registrar o histórico de snapshots **a partir de sua inscrição**, não reconstruir artificialmente o que não foi capturado.
- Ao parar monitoramento, preservar dados e permitir replay; parar novas coletas **agregadas municipais** e remover prioridade zonal. A coleta nacional de segmentos continua; não apagar snapshots zonais nem reconstruir passado anterior à captura.
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

**Alterado pelo Aditivo 01, §§5–7:** contrato alvo para coorte zonal e suas matrizes; campos/rotas ainda não entregues devem ser identificados como pendentes, conforme [VALIDACAO.md](VALIDACAO.md).

Prefixo `/api/v1`. Implementar REST e um único fluxo SSE. Contratos internos TypeScript compartilhados em `packages/domain`.

| Método/rota | Função |
|---|---|
| `GET /health` | `ok`, modo, banco, última captura, versão |
| `GET /api/v1/bootstrap` | parâmetros da eleição, disponíveis e capacidades ativas |
| `GET /api/v1/territories?q=&kind=&uf=` | busca por UF/município |
| `GET /api/v1/watchlist` | municípios salvos e status |
| `POST /api/v1/watchlist` | adicionar município e priorizar sua fila zonal; legado `collectBu=false` sem efeito comparativo |
| `DELETE /api/v1/watchlist/:id` | desativar, sem apagar histórico |
| `GET /api/v1/snapshots?office=&territory=&from=&to=` | séries oficiais |
| `GET /api/v1/latest?office=&territory=` | último resultado válido |
| `GET /api/v1/coverage?office=&territory=&at=` | progresso + denominação |
| `GET /api/v1/comparison?territory=&at=&mode=full\|cohort&historicalYear=2018\|2022` | coorte única, seis shares, lideranças por ano, duas matrizes, cobertura e método; ano seleciona destaque, não muda a coorte |
| `GET /api/v1/comparison/units?territory=&at=&sort=&filter=` | tabela ordenável/filtrável de ZEs ou segmentos no recorte, com fontes e líderes dos três anos |
| `GET /api/v1/timeline?office=&territory=&layer=` | snapshots compactos para gráfico |
| `GET /api/v1/sources/:snapshotId` | proveniência, URL, tempos, hashes, fase |
| `GET /api/v1/events` | SSE: `official.updated`, `cohort.updated`, `watchlist.updated`, `source.status` |

Todos os endpoints retornam números inteiros como `number` se não ultrapassarem safe integer do JS; proporções como número decimal em `[0,1]` **ou `null`**. Strings para identificadores eleitorais, inclusive com zeros à esquerda. Retornar `basis` / `universe` / `comparisonMode` sempre que houver porcentagens históricas.

**Contrato de disponibilidade:** enquanto fonte zonal, cadastro, históricos ou identidades não estiverem validados, responder `status=pending_validation` no modo de coorte (ou status externo de indisponibilidade com esse motivo), `enabled=false` e motivos específicos. Contagens/shares desconhecidos devem ser omitidos ou `null`, nunca apresentados como uma coorte vazia calculada. Governador permanece fora do escopo histórico.

**Exemplo alvo de comparação por coorte, inteiramente sintético (não implementado por este exemplo):**

```json
{
  "mode": "cohort",
  "environment": "fixture",
  "status": "ready",
  "office": "president",
  "round": "1",
  "territory": { "kind": "uf", "id": "ac" },
  "unitKind": "whole_zone",
  "asOf": "2026-10-02T20:00:00.000Z",
  "basis": "historical_zone_cohort",
  "universe": "Somente zonas completas e conciliadas (2018, 2022 e 2026)",
  "candidateMapping": "synthetic_only",
  "historicalYear": 2018,
  "cohortVersion": "fixture-cohort-1",
  "coverage": {
    "expected2026": 3,
    "finalized2026": 2,
    "comparisonCohortCount": 1,
    "incomplete": 1,
    "unmatched": 1,
    "pendingValidation": 0,
    "shareOfOfficialValidVotes": null,
    "exterior": { "status": "outside_scope", "reason": "Recorte UF" }
  },
  "series": {
    "bolsonaro": {
      "2018": { "votes": 60, "validVotes": 100, "share": 0.6 },
      "2022": { "votes": 40, "validVotes": 100, "share": 0.4 },
      "2026": { "votes": 30, "validVotes": 100, "share": 0.3 }
    },
    "lula_haddad": {
      "2018": { "votes": 30, "validVotes": 100, "share": 0.3 },
      "2022": { "votes": 50, "validVotes": 100, "share": 0.5 },
      "2026": { "votes": 60, "validVotes": 100, "share": 0.6 }
    }
  },
  "leaders": {
    "2018": { "bolsonaro": 1, "lula_haddad": 0, "outros": 0, "empate": 0 },
    "2022": { "bolsonaro": 0, "lula_haddad": 1, "outros": 0, "empate": 0 },
    "2026": { "bolsonaro": 0, "lula_haddad": 1, "outros": 0, "empate": 0 }
  },
  "transitions": {
    "2018": {
      "bolsonaro": { "bolsonaro": 0, "lula_haddad": 1, "outros": 0, "empate": 0 },
      "lula_haddad": { "bolsonaro": 0, "lula_haddad": 0, "outros": 0, "empate": 0 },
      "outros": { "bolsonaro": 0, "lula_haddad": 0, "outros": 0, "empate": 0 },
      "empate": { "bolsonaro": 0, "lula_haddad": 0, "outros": 0, "empate": 0 }
    },
    "2022": {
      "bolsonaro": { "bolsonaro": 0, "lula_haddad": 0, "outros": 0, "empate": 0 },
      "lula_haddad": { "bolsonaro": 0, "lula_haddad": 1, "outros": 0, "empate": 0 },
      "outros": { "bolsonaro": 0, "lula_haddad": 0, "outros": 0, "empate": 0 },
      "empate": { "bolsonaro": 0, "lula_haddad": 0, "outros": 0, "empate": 0 }
    }
  },
  "sourceVersions": {
    "registry": "fixture-registry-1",
    "history2018": "fixture-2018-1",
    "history2022": "fixture-2022-1",
    "matches": "fixture-matches-1",
    "algorithm": "zone-cohort-v1"
  }
}
```

Números fabricados para revisar o contrato; não validam fonte nem identidade oficial. As duas séries compartilham denominador por ano; lideranças, matrizes e shares usam a mesma unidade elegível. `finalized2026` inclui unidades excluídas da coorte por histórico, portanto não deve ser somado a `comparisonCohortCount`. Motivos de exclusão podem se sobrepor; expor essa semântica ou uma partição explícita, sem fabricar fechamento.

`basis` descreve a metodologia (`official_aggregate` ou `historical_zone_cohort`); `environment` descreve a origem. Os snapshots legados do primeiro fluxo usam `ea20|synthetic` como discriminante de fonte. Preservá-los; mapear/adicionar a base metodológica ao evoluir o contrato, sem reclassificar dados sintéticos como oficiais.
---

## 11. Interação, legibilidade e acessibilidade

### 11.1 Convenções numéricas

- Locale `pt-BR`; inteiros com agrupamento (`123.456`), participações com uma casa decimal (`43,2%`) e diferenças em pontos percentuais (`+1,7 p.p.`).
- Tooltips mostram valores originais completos; não truncar contagens de votos nos detalhes.
- Nunca codificar sinal exclusivamente por cor; usar `+`, `−` e rótulo da métrica.
- Dados não disponíveis são `—` + explicação `Não publicado`, `Não monitorado`, `Sem coorte` ou `Fonte indisponível`.
- Escalas do gráfico explícitas; exibir se eixo Y foi aproximado/zoom; nenhuma animação que sugira observações intermediárias inexistentes.
- Distinção de estilo entre `EA20 oficial agregado`, `Zonas concluídas e conciliadas`, `histórico final`, `simulado` e `fixture`. BU, se futuramente habilitado como extensão, mantém rótulo/fonte próprios.

### 11.2 Interações principais

1. Selecionar Brasil/UF/Município via mapa e busca.
2. Alternar Presidente/Governador; preservar território onde faz sentido.
3. Salvar/remover município para ativar/desativar coleta agregada municipal e ajustar prioridade zonal; expansão nacional continua.
4. Alternar Resultado/Cobertura/Comparação sem perder instante selecionado.
5. Mover timeline/replay ou retornar ao presente.
6. Na Comparação, alternar `Participação (%)` e `Diferença (p.p.)`.
7. Na Comparação, priorizar `Zonas concluídas e conciliadas`; manter `Referência histórica final` separada, se disponível. Alternar `2018→2026` / `2022→2026` sem mudar a coorte.
8. Abrir matriz 4×4, tabela ordenável/filtrável, unidades incluídas/excluídas, denominação, método de correspondência, proveniência e status da fonte.

### 11.3 Rótulos permitidos

- `Resultado oficial acumulado`.
- `Seções totalizadas` / `Eleitorado das seções totalizadas`.
- `Zonas concluídas e conciliadas`.
- `Zonas eleitorais completas` / `Zonas eleitorais comparáveis` no Brasil/UF.
- `Unidades município–zona completas/comparáveis` no município.
- `Mudança de primeiro colocado na zona`; `Lula/Haddad → Bolsonaro` / `Bolsonaro → Lula/Haddad`.
- `Participação nos votos válidos`.
- `Diferença observada (p.p.)`.
- `Histórico final do território — cobertura diferente`.
- `Histórico reconstruído sobre zonas completas e conciliadas`.

**Alterado pelo Aditivo 01:** `Boletins disponíveis processados` só se aplica à eventual extensão de BU, nunca ao modo comparativo zonal.

Não usar `probabilidade de vitória`, `voto migrado`, `eleitor mudou de lado`, `tendência de vitória`, `liderança consolidada`, `amostra representativa` como rótulos próprios do sistema.

---

## 12. Modo simulado, replay e preparo para o domingo

### 12.1 Isolamento

Exigir `TSE_ENV=official|simulated|fixture`. `official` só aceita URLs da origem oficial aprovada, configuração 2026 confirmada e `f="o"` para publicações de resultado; `simulated` só aceita origem do simulado e `f="s"`. `fixture` não faz chamadas de rede e usa artefatos versionados. Não compartilhar chaves de snapshots entre ambientes.

### 12.2 Replay

O replay lê snapshots locais e reproduz os eventos na ordem **de captura**, exibindo também o horário da fonte. Não inventa dados entre capturas, não reconsulta o TSE e não emite novas atualizações na base de produção.

### 12.3 Validação pré-eleição

**Alterado pelo Aditivo 01, §§8–10:** BU não é condição para habilitar comparação histórica.

- Demonstrar bootstrap com EA11 real disponível antes da eleição.
- Ler e validar EA14/EA20 do ambiente de simulado com resultados não nulos.
- Simular a ordem de chegada de respostas fora de sincronia.
- Verificar mapa, timeline e seleção de município sem rede ao TSE (fixtures locais).
- Obter EA20 município–zona real/simulado, validar contrato e exceções de conclusão; conferir cadastro de todos os segmentos de uma ZE com mais de um município.
- Importar históricos nominais por município e zona de 2018/2022, validar identidades/categorias de voto e medir conciliação estrutural auditável com cadastro 2026.
- Executar casos de liderança real, empates, matrizes, reversão de retificação e replay sem informação futura. Se fontes/cadastro/match não forem comprovados, modo B permanece `pending_validation`, com motivos; núcleo continua disponível.
- Medir expansão nacional, latência de varredura/detecção, tráfego e cobertura histórica sob orçamento conservador. Relatar separadamente evidência oficial, simulado e fixture.
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

### Comparação histórica — prioridade zonal, entrega incremental

**Alterado pelo Aditivo 01, §8.** Checklist alvo; execução comprovada é registrada em `VALIDACAO.md`.

- [ ] Importadores históricos 2018 e 2022 por município e zona para Presidente/1º turno, com todos os candidatos e denominadores válidos.
- [ ] Série Bolsonaro: Jair 2018 → Jair 2022 → Flávio 2026.
- [ ] Série Lula/Haddad: Haddad 2018 → Lula 2022 → Lula 2026.
- [ ] Identidades de 2026 resolvidas a partir de fonte oficial validada.
- [ ] Histórico final não é rotulado como coorte equivalente.
- [ ] EA20 zonal validado, com rejeição de fase/cargo/turno/eleição/território divergentes, e exceções de conclusão documentadas.
- [ ] Cadastro completo de segmentos; ZE com dois municípios conta uma vez Brasil/UF e só conclui após ambos.
- [ ] Coorte comum exclui unidades sem compatibilidade verificada em qualquer ano, com auditoria territorial e tratamento de ZZ.
- [ ] Nenhuma unidade histórica/segmento/ZE entra duas vezes no mesmo recorte; unidade municipal explicitamente rotulada.
- [ ] Liderança considera todos os candidatos; outros/empates preservados, indefinidos excluídos.
- [ ] Contagens por ano e matrizes 4×4 fecham exatamente a mesma coorte; saldos das quatro classes somam zero, sem impor igualdade dos fluxos diretos.
- [ ] Três curvas por série e quatro deltas p.p. calculados por funções puras, testadas.
- [ ] Shares ponderados por votos, timeline de contagens/fluxos e replay determinístico, inclusive retirada por retificação.
- [ ] Cobertura, exclusões, método, horários, tabela filtrável/ordenável e duas bases visíveis, sem misturar denominação oficial e coorte.
- [ ] Coleta zonal avança nacionalmente sob orçamento medido; salvos mudam prioridade, não abrangência. Remover favorito não interrompe expansão.
- [ ] Ausência de prova zonal/histórica mantém `pending_validation`; coleta/conciliação nacional **oficial** só é declarada validada com evidência própria, nunca somente fixtures.

---

## 14. Ordem de desenvolvimento e entregas

**Alterado pelo Aditivo 01, §9:** preservar o primeiro fluxo fixture, SQLite, mapa, snapshots, watchlist e timeline já entregues. Próxima prioridade comparativa é validar e implementar zonas completas, lideranças e transições; não aguardar parser BU nem usar entrega de referência final como bloqueio. As etapas abaixo são incrementais e não indicam conclusão.

**Etapa 0 — Observação de formatos:** preservar capturas EA11/12/14/15/20 e provas EA16/18 existentes. Complementar com EA20 município–zona real/simulado, regra de conclusão/exceções e completude do cadastro de segmentos; confrontar CSV nominal municipal/zonal 2018/2022 (encoding, colunas, cargo, turno, destinação, IDs). Atualizar schemas e contratos apenas com evidência; sem prova, `pending_validation`.

**Etapa 1 — Vertical slice:** Node+SQLite+endpoint `/latest` alimentado por fixture; React+mapa de UFs, cartão Resultado e atualização simulada; botão Replay.

**Etapa 2 — Coleta oficial:** scheduler, EA14, EA20 Brasil/UF, status, deduplicação, timestamps, modo oficial resiliente.

**Etapa 3 — Monitoramento municipal:** catálogo EA12, malha municipal, busca, watchlist, EA15, EA20 de município salvo, persistência.

**Etapa 4 — Timeline completa oficial:** gráficos acumulados, cobertura, replay, contagens e tempos da fonte; todos os componentes sincronizados ao instante selecionado.

**Etapa 5 — Fundação histórica zonal:** ETL 2018/2022 de todos os candidatos e válidos, migrations normalizadas, cadastro completo 2026 e correspondências auditáveis nos dois anos. Referências finais territoriais podem reutilizar o ETL, com cobertura distinta.

**Etapa 6 — Comparação por zonas completas (prioritária):** funções puras e fixtures para completude ZE/segmento, elegibilidade, líder real, contagens e matrizes 4×4; invariantes e retificações. Integrar coleta zonal nacional progressiva, persistência, replay, cartões de trocas diretas, tabela/matriz, seis shares, quatro deltas e timeline em degraus. Habilitar fontes oficiais somente após validação própria; medir latência/cobertura e registrar limitações.

**Etapa 7 — Estabilidade no dia:** rodar teste de carga local, watchdog, backup SQLite, exportação JSON/CSV de série, validação e monitoramento dos erros/404.

**Extensão independente, sem bloquear MVP:** eventual EA16→EA18→BU, decodificador, proveniência e testes próprios. Não manter um segundo motor de comparação histórica por BU concorrendo com o zonal.

**Critério para seguir à etapa seguinte:** testes da etapa anterior verdes, demonstração em fixture e registro do que está validado/pendente. Um recurso não validado deve ficar desligado, não simular funcionamento.

---

## 15. Riscos e decisões pré-aprovadas

| Risco/limitação | Tratamento decidido |
|---|---|
| EA14/EA15 e EA20 com tempos de publicação diferentes | Metadados por feed; nunca snapshot global fictício |
| Cenários de anulação e sub judice | Preservar destinação de votos e validação do denominador |
| Endpoint zonal ausente/404 e bloqueio CDN | Descoberta via EA11/documentação/índices; fonte pendente, orçamento baixo, backoff, sem loops |
| ZE abrange vários municípios / reorganização histórica | Cadastro completo, auditoria estrutural e contagem distinta; igualdade UF+ZE não basta |
| Zona/município/UF com cortes diferentes | `official_aggregate` e `historical_zone_cohort` separados; sem soma parcial substituindo total oficial |
| Varredura nacional lenta | Medir latência, bytes e quantidade de unidades; mostrar última coleta/processamento e cobertura |
| Retificação invalida zona antes completa | Preservar versões e recalcular coorte/matrizes, permitindo retirada |
| Candidatura de 2026 indisponível/não resolvida | Exibir `candidate_unresolved`; não procurar votos por nome aproximado |
| DF, exterior e situações territoriais específicas | Tratamento de geografia explícito; não forçar soma/cartografia incoerente |
| Máquina desligada durante apuração | Perda de snapshots intermediários é admitida; não inventar histórico nem afirmar coleta contínua |
| Mudança do layout TSE | Schemas versionados + fixture tests; interromper componente afetado |
| Prazo curto para 04/10 | Preservar núcleo funcionando e priorizar comparação zonal; habilitar com prova de fonte/cadastro/histórico, sem dependência de BU |

---

## 16. Decisões de arquitetura fechadas / a descobrir

### Fechadas

- Um único usuário; local; sem login; sem cloud.
- Primeiro turno de 2026; Executivo (Presidente e Governador).
- Agregado Brasil/UF contínuo; agregado municipal EA20 somente sob demanda salvos; coleta município–zona nacional progressiva, com favoritos como prioridade.
- Três camadas equivalentes: Resultado, Cobertura, Comparação.
- `official_aggregate` e `historical_zone_cohort` têm tempos/denominadores próprios; BU experimental independente. Brasil/UF contam ZE inteira distinta; Município conta segmento rotulado.
- Correspondências históricas Bolsonaro e Lula/Haddad conforme seção 5.
- Sem previsão, probabilidade eleitoral, diagnóstico, narração automática ou inferência de voto individual.
- Stack React/Vite, MapLibre, ECharts, Fastify, SQLite e TypeScript.

### Investigar na etapa 0, sem inventar

- Contrato/caminho real EA20 município–zona e condição de conclusão, incluindo seções não instaladas, anulações e retificações.
- Completude do cadastro de segmentos, formação de ZEs inteiras e tratamento do exterior.
- Colunas/encoding dos históricos nominais municipais/zonais e taxa real de conciliação estrutural 2018/2022/2026, com reorganizações auditadas.
- Disponibilidade de URLs reais depois de 17h do dia 04/10 e eventuais mudanças de schema da CDN.
- Cardinalidade nacional, bytes médios, taxa/concorrência, tempo de varredura, latência da conclusão e defasagem zona/município/UF.
- Importação normalizada e recomputação incremental determinística, com versões de match/identidade/cadastro respeitando `asOf`.

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

## 18. Histórico de revisões

| Revisão | Alteração | Evidência de implementação |
|---|---|---|
| 1.0 — 02/10/2026 | Especificação inicial, comparação por coorte de BU em municípios salvos | [Cópia integral preservada](history/pre-aditivo-01/ESPECIFICACAO.md); provas do primeiro fluxo em `VALIDACAO.md` |
| 1.1 — 02/10/2026 | Integra Aditivo 01: §§1.1/1.2, 3.1, 4.1–4.4, 5.1 modo B e 5.2–5.5; alinha princípios, fontes históricas, topologia, persistência, scheduler, API, UI, aceite, roadmap e riscos | Migração documental e estado de indisponibilidade; cálculo/coleta/conciliação nacional zonal ainda pendentes, não comprovados por fixtures do primeiro fluxo |

Vigente: EA20 município–zona → ZE inteira concluída → coorte verificada nos dois históricos → contagens/lideranças/matrizes. Preservados: stack, execução local, isolamento de ambientes, agregados municipais somente salvos, mapa municipal, snapshots imutáveis, resultado/cobertura/timeline e observações TSE anteriores. Aditivo original mantido sem alteração.
