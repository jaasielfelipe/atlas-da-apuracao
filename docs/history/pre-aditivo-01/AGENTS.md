# AGENTS.md — Atlas da Apuração

Estas instruções orientam o Codex neste repositório. A fonte funcional/técnica de verdade é `docs/ESPECIFICACAO.md`.

## Objetivo

Construir um painel **local, de usuário único**, para a apuração das Eleições Gerais brasileiras de 2026, primeiro turno, cargos Presidente e Governador. Interface cartográfica Brasil → UF → município, coleta municipal somente de municípios **salvos** e exploração temporal em três camadas equivalentes: Resultado, Cobertura e Comparação.

## Regras inegociáveis

1. Sem autenticação, contas, SaaS, Docker obrigatório, deploy, PostgreSQL, Redis ou coleta excessiva. Servidor apenas em `127.0.0.1`.
2. Use React/Vite/TypeScript, MapLibre, ECharts, Node/Fastify e SQLite WAL. Estruturar contratos tipados, migrations e fixtures.
3. TSE é a fonte primária. Descobrir URLs via EA11 e seguir EA12/EA14/EA15/EA20; para BU seguir EA16→EA18. Validar fase, eleição, turno, abrangência e status dos votos.
4. Ambiente `simulated` ou `fixture` **nunca** pode ser apresentado como oficial. Um eventual `f=s` na rota oficial exige falha de validação.
5. Cache condicional ajuda a banda, mas 304 conta como requisição. TSE: limite anunciado de 100 req/s por IP, com risco de bloqueio de 10 min; operar muito abaixo (padrão 2–5 req/s). Não fazer loops de 404.
6. `EA20 oficial` e `BU disponível` são bases diferentes. Receber BU não prova totalização oficial. Metadados, hora e denominação separados.
7. Snapshots imutáveis, sem interpolação temporal nem preenchimento de lacunas.
8. Comparação analítica presidencial:
   - série `bolsonaro`: Jair Bolsonaro 2018; Jair Bolsonaro 2022; Flávio Bolsonaro 2026;
   - série `lula_haddad`: Fernando Haddad 2018; Lula 2022; Lula 2026.
   - Primeiros turnos apenas. Candidatos 2026 somente após resolução dos identificadores oficiais, nunca por fuzzy matching.
9. Para coorte, usar somente unidades de 2026 conciliáveis com **ambas** as eleições históricas; não contar agregações/sections em duplicidade; mostrar cobertura e método.
10. Sem diagnósticos, narrativas, previsão, probabilidades de resultado, transferências individuais inferidas, avaliações políticas ou retórica interpretativa.
11. Zero ≠ ausente. Exibir `—`/estado específico quando denominador não definido ou fonte indisponível.
12. Não processar IDs territoriais como inteiros: preservar zeros iniciais.

## Método de trabalho

- **Primeiro:** ler toda a especificação, depois validar fontes reais e fixtures do simulado 2026.
- Trabalhar em etapas pequenas com testes executáveis e documentação do que está pronto.
- Priorizar funcionamento no domingo (04/10/2026): núcleo EA20/EA14, mapa, snapshots, watchlist, timeline. Modo coorte BU é extensão condicionada a validação completa.
- Usar funções puras para métricas, timestamp e coortes, com Vitest e exemplos sintéticos que incluam falhas.
- Não introduzir bibliotecas/infraestrutura novas por preferência pessoal: justificar qualquer desvio da stack.
- Antes de registrar feature pronta: build, typecheck, testes e validação visual devem passar.
- Se fonte/schema não estiver disponível, criar adapter desacoplado e modo fixture; **não inventar** contrato oficial ou dados reais.

## Fonte de referência

TSE: https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados

Confira `docs/CONTRATOS_E_TESTES.md` para cenários de verificação e checklists. Atualize a documentação quando uma hipótese técnica for confirmada por arquivos reais.
