# Execução local e pendências operacionais

Atualizado em 02/10/2026, execução iniciada às 21h BRT. Leia `VALIDACAO.md` para distinguir provas sintéticas, simulado e oficial.

## Demonstração

`pnpm dev` serve frontend em 127.0.0.1:5173 e API em 127.0.0.1:3001. `pnpm build && pnpm start` serve a versão compilada em 127.0.0.1:3001. Não executar os dois simultaneamente. Nenhuma coleta TSE acontece nesse fluxo.

Migrations 001→002→003 são transacionais e preservam o acervo agregado. A fixture zonal é inserida somente até o cursor capturado e independe de favoritos. Não apagar `data/atlas.sqlite` para atualizar a versão.

Use `pnpm backup` para uma cópia consistente de `data/atlas.sqlite`, incluindo páginas no WAL. O script usa a API de backup do SQLite e verifica `integrity_check`. Saída em `data/backups/atlas-<instante>.sqlite`. Para experimentar uma cópia sem substituir o original, defina `ATLAS_DB` para o caminho dessa cópia antes de iniciar o servidor. Não copie apenas o arquivo principal enquanto há escritas no WAL.

## Históricos reais — importação opt-in

Os arquivos ZIP baixados nesta execução somam aproximadamente 951,5 MB. Estão ignorados no Git em `data/history`, junto aos CSV presidenciais BR extraídos. Não carregar `BRASIL.csv`: inclui outros cargos e tem vários GB.

Para reproduzir numa máquina limpa, na raiz do projeto:

```powershell
node scripts/download-history.mjs
powershell -File scripts/extract-history.ps1
pnpm inspect:history
pnpm import:history
```

Não repetir os downloads se os arquivos já estão disponíveis. O script faz dois downloads únicos sem retries; a extração recusa sobrescrever os CSV existentes. `inspect:history` produz recortes AC transformados, metadados e hashes; `import:history` carrega 2018/2022 em `data/history/atlas-history.sqlite`, sem habilitar uso oficial na aplicação. As linhas em trânsito são partições distintas, cuja repetição é rejeitada antes de somar votos do mesmo candidato. Votos válidos vêm de `QT_VOTOS_NOMINAIS_VALIDOS`, conciliados com a destinação e o nominal. Todos os candidatos presidenciais são mantidos.

O relatório `packages/fixtures/history/reconciliation-ac.json` registra nove zonas com mesma composição municipal e estado `review`. Falta auditar reorganizações, limites e compatibilidade estrutural. Igualdade de UF+ZE ou da lista de municípios não concede `verified`. Os recortes AC não substituem os arquivos integrais como cadastro nacional.

## Fila nacional — componente ainda desacoplado

`packages/tse/src/collector.ts` controla um único orçamento (padrão 500 ms entre inícios; 2 req/s), cache condicional, contagem de 304, pausa global por 429/403, backoff e suspensão definitiva de 404 durante a instância. Um de cada quatro slots prioriza a unidade mais atrasada; os demais priorizam agregados/favoritos. Remover favorito suspende somente agregado municipal e retira prioridade zonal. A fila não depende de mudança em EA14/EA15 para revisitar pendentes.

Atualização de 03/10: migration 004 e `PersistentCollector` persistem fila, pausas, cache comprimido por hash e observações HTTP. `tseTransport` oferece timeout de 20s, limite de 4 MiB, origem/fase e validação obrigatória por callback, sem redirects ou retries. Uso pelo serviço: `collector.tick(tseTransport({ validate }))`; o callback deve vincular o corpo ao contrato e contexto EA11/EA12 da unidade. O cache é atualizado somente após essa validação. Respostas idênticas reutilizam o corpo; 304 exige cache prévio. A cota é salva antes de enviar HTTP.

Este serviço ainda deve ter **uma única instância proprietária** por banco/IP; não há lease entre processos. Não iniciar dois coletores independentes. Ainda faltam ligar planejamento nacional/EA11/EA12 aos adapters de cada job, persistência de snapshots zonais reais a partir das respostas aceitas, coordenação de propriedade entre processos, descoberta de mudanças cadastrais, relatórios de latência e medição de conclusão. Observações registram bytes aceitos do corpo, não todo o tráfego na rede; respostas inválidas/abortadas ainda não contabilizam bytes parciais. Testes usam transporte injetado; não houve polling real nesta atualização. O runtime recusa `TSE_ENV=official` e `simulated`.

Cadastro EA12 oficial observado: 6.292 segmentos, 2.641 chaves UF+ZE, incluindo 186 segmentos ZZ. A 2 req/s, só uma passagem por esses segmentos requer pelo menos 3.146 segundos; o orçamento também precisa atender agregados e lidar com latências. Não prometer atualização nacional imediata.

## Condições para habilitar dados reais

1. Comprovar EA20 zonal oficial com totalização positiva e destinação conhecida; resolver seção não instalada/anulada e demais exceções com evidência.
2. Auditar conciliação completa 2018/2022/2026 e exclusões, inclusive exterior; registrar método/fontes e versões temporais.
3. Vincular IDs candidatos confirmados à configuração/eleição e seus hashes; nunca reutilizar IDs sintéticos.
4. Integrar transporte/cache/fila persistida e medir cobertura/defasagem sob o orçamento compartilhado, ensaiando falha e reinício.
5. Passar testes, typecheck, build e revisão visual com as novas fontes antes de alterar capacidades oficiais.

Não há coleta nem conciliação nacional oficial validada nesta entrega.
