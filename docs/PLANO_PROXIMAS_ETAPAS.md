# Plano de continuidade — 02/10/2026

Início solicitado: **02/10/2026 às 21h, America/Sao_Paulo (03/10 às 00h UTC)**, neste chat. Agendamento de início único, não recorrência diária. Este plano não promete terminar todas as etapas nesta noite.

## Ponto de partida

Repositório: `jaasielfelipe/atlas-da-apuracao`. Primeiro fluxo fixture, SQLite WAL, mapa, watchlist e timeline preservados. Última validação: 21 testes, um fluxo E2E, typecheck/build e inspeção visual aprovados. Comparação zonal, históricos e coleta nacional oficial continuam pendentes. Ler AGENTS.md, especificação 1.1, Aditivo 01, contratos e VALIDACAO.md antes de iniciar; conferir alterações locais feitas desde o agendamento.

## Ordem de execução e critérios de saída

1. **Complementar a etapa 0: fonte zonal e cadastro.** Descobrir EA20 município–zona via EA11/documentação TSE; capturar amostras reais/simuladas com URL, fase, horários e hashes. Validar abrangência, identificadores, ts/st/snt, votos/destinação e exceções. Construir cadastro completo de segmentos de cada ZE; buscar caso com vários municípios e tratar ZZ. Criar testes ZA/ZB aplicáveis. Saída: contratos comprovados e pendências explícitas; sem prova, adapter desacoplado e `pending_validation`, sem loops 404.

2. **Núcleo comparativo puro com fixtures.** Implementar completude de segmento/ZE, elegibilidade comum nos três anos, líder real entre todos os candidatos, contagens e duas matrizes 4×4. Calcular shares ponderados por votos e quatro deltas; replay por captura e reversão por retificação. Executar ZB/ZC/ZD/ZE sintéticos: dois municípios, terceiros, empate, denominador zero, fluxos 2 versus 1, dupla contagem e ausência de informação futura. Saída: invariantes executáveis e determinísticos, sem depender da disponibilidade oficial.

3. **Histórico e persistência normalizada.** Validar CSV nominais município–zona de 2018/2022, primeiro turno presidencial, encoding/colunas e todos os candidatos necessários. Preservar original e transformação, resolver identidades por IDs confirmados e auditar correspondência cadastral/reorganizações nos dois históricos. Implementar migrations SQLite para cadastro, resultados, candidaturas, matches e coorte, preservando o banco existente. Testar migração, integridade, isolamento de ambiente, deduplicação, reinício e cortes temporais. Saída: conciliação demonstrada num recorte de prova; não extrapolar como validação nacional.

4. **Primeiro fluxo comparativo completo.** Integrar motor → SQLite → API → React/ECharts, inicialmente em fixture explicitamente identificada. Mostrar concluídas/comparáveis/esperadas, lideranças com outros/empates, seletor 2018→2026 / 2022→2026, trocas diretas e matriz completa, tabela ordenável/filtrável e timeline por estados observados. Brasil/UF contam ZE inteira; município conta município–zona. Preservar geometria municipal e bases distintas do agregado oficial. Saída: testes de integração, E2E e revisão visual desktop/mobile aprovados.

5. **Coleta oficial e expansão zonal nacional.** Implementar scheduler único com orçamento global conservador, cache condicional, digest, backoff e suspensão de 404. Preservar prioridade BR/UF e agregado municipal somente salvo; favoritos priorizam, mas não limitam, a fila zonal nacional. EA14/EA15 são pistas; varrer pendentes periodicamente e medir volume, bytes, duração da varredura, atraso de conclusão e defasagem entre fontes. Saída: evidência de funcionamento/latência e cobertura, com capacidade oficial habilitada somente quando os contratos estiverem comprovados.

6. **Preparação operacional para 04/10.** Ensaiar indisponibilidade, reinício, correções, persistência, replay, backup/exportação e limites de tráfego. Atualizar instruções de execução e relatório de pendências. Saída: checklist operacional honesto; funcionalidades sem prova permanecem desativadas.

## Execução e registro

- Às 21h, começar efetivamente pela etapa 1 deste plano e seguir as dependências; não apenas emitir um lembrete. Não iniciar implementação antecipadamente por causa deste planejamento.
- Trabalhar em incrementos pequenos. Rodar testes pertinentes em cada etapa; antes de declarar funcionalidade pronta, executar testes, typecheck, build e validação visual quando houver UI.
- Atualizar `docs/VALIDACAO.md` com comandos/resultados e separar fixture, simulado TSE e oficial. Indicar explicitamente se coleta e conciliação nacional oficial foram comprovadas.
- Falha de fonte não bloqueia trabalho independente em funções puras/fixtures. Não inventar schema, identidades ou correspondências para remover uma pendência.
- Preservar stack e execução em 127.0.0.1. BU permanece extensão independente, fora do caminho crítico. Não criar infraestrutura adicional nem inferências políticas ou individuais.
- Respeitar alterações locais do usuário e registrar o progresso ao encerrar a execução, com próximos itens e bloqueios concretos. O agendamento autoriza iniciar o trabalho; não estabelece prazo garantido de conclusão.

## Progresso da execução iniciada às 21h

1. Provas EA20 zonal/cadastro: três segmentos simulados concluídos de uma ZE multmunicipal; amostra oficial ainda parcial; exceção BA em revisão. Originais e hashes preservados.
2. Motor/fixtures: implementado e testado, incluindo contagens, duas matrizes, pesos, retificação e replay.
3. Histórico/persistência: arquivos nacionais 2018/2022 importados em SQLite separado; prova estrutural das nove ZEs AC permanece `review`, sem auditoria de reorganizações. Migrations normalizadas implantadas.
4. Fluxo comparativo fixture: API/UI/tabela/matriz/timeline, E2E e revisão visual aprovados. Cartografia comparativa e exportação pendentes.
5. Coleta nacional: componente de orçamento/cache/backoff/justiça testado com transporte sintético; integração real/persistência/latência ainda pendentes. Não habilitada.
6. Operação: migração/reinício/falhas/replay testados, backup consistente executado. Aceite de operação oficial pendente.

Registro final desta execução: **41 testes + 1 E2E**, build/typecheck/format aprovados. Evidências e limites detalhados em `VALIDACAO.md`; continuidade em `OPERACAO.md`. Sem recorrência adicional.
