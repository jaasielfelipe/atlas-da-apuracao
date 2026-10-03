# Checklist operacional — domingo 04/10/2026 (1º turno)

Painel local, usuário único, `127.0.0.1`. Coleta oficial contínua a até **80 req/s** (decisão do usuário; TSE anuncia 100 req/s por IP). Detalhes técnicos em `OPERACAO.md`; evidências em `VALIDACAO.md`.

## Antes (manhã / início da tarde)

- [ ] `git pull`, `pnpm install --frozen-lockfile`, `pnpm build`, `pnpm test` (Node 24 LTS + pnpm 11.19.0 já instalados).
- [ ] Espaço em disco: reservar **≥ 10 GB** livres. Ensaio no simulado: ~80 MB para ~10 mil requisições; corpos são deduplicados por hash e 304 não grava corpo, mas cada versão nova de zona/agregado grava um corpo comprimido.
- [ ] `pnpm backup official` (cópia consistente antes de começar).
- [ ] Nenhum outro coletor/benchmark rodando nesta máquina ou **neste IP** (o lock só enxerga esta máquina). Não rodar o coletor simulado durante o oficial.
- [ ] Rede estável; desativar suspensão/hibernação do computador.

## Início (~16h30 de Brasília; urnas fecham às 17h)

Dois terminais na raiz do projeto:

```powershell
# Terminal 1 — API + painel
pnpm start                     # http://127.0.0.1:3001

# Terminal 2 — coletor oficial contínuo
pnpm collect:official:live     # Ctrl+C para parar com drenagem
```

- [ ] Abrir `http://127.0.0.1:3001/live/official` (painel principal oficial). Cabeçalho deve mostrar **OFICIAL TSE** e **Coletor ativo**.
- [ ] Primeira linha do coletor: `cadastro 95a5a0a7530a … 6379 jobs`. Se o digest do cadastro mudar, ver “Incidentes”.
- [ ] Rampa esperada: 10 → 80 req/s em ~105 s. Varredura nacional completa em ~2–3 min (medido no simulado).
- [ ] Salvar até 20 municípios de interesse no painel: o coletor inicia o agregado municipal em ≤10 s, sem reinício. Zonas são nacionais independentemente dos favoritos.

## Acompanhamento (a cada 10 s no terminal 2 e em `data/official/collector-status.json`)

| Campo | Normal | Atenção |
|---|---|---|
| `req/s` observado | sobe até ~80 na varredura, depois o necessário (≈57 com zonas pendentes) | 0 por mais de 30 s sem `PAUSADO` |
| `erros` | 0 ou poucos | crescendo continuamente |
| `PAUSADO até …` | ausente | presente = TSE respondeu 403/429 |
| `ZEs completas` | cresce durante a noite | — |
| `recentErrors` | vazio | mensagens de validação (fase, eleição, cadastro) |

- Comparação histórica só conta **ZE inteira concluída** (`ts>0`, `snt=0`, `st=ts`) e conciliada: é normal ficar em 0 no início.
- Timeline grava snapshot somente quando o conteúdo muda; sem interpolação.
- Resultados municipais existem apenas para municípios salvos; demais aparecem em cinza (“sem snapshot”), nunca como zero.

## Incidentes

- **403/429 (bloqueio):** o coletor já pausa tudo ≥10 min (ou `Retry-After`) e volta da taxa mínima com nova rampa. Se repetir, parar (Ctrl+C) e reiniciar com taxa menor: `$env:TSE_RPS=40; pnpm collect:official:live`.
- **Processo caiu / computador reiniciou:** apenas rodar de novo `pnpm collect:official:live`. Ele recupera o lock de processo morto, espera o lease anterior expirar (≤60 s) e retoma do SQLite (fila, ETags e cota). Ensaiado com `taskkill /F` no simulado.
- **5xx/timeout em massa:** a taxa cai à metade automaticamente e as unidades entram em backoff (≤10 min). Não reiniciar em loop.
- **`FALHA: Banco/eleição/cadastro incompatível`:** o TSE mudou EA11/EA12. Não forçar. Parar, `pnpm backup official`, mover `data/official/collection.sqlite*` para outra pasta e reiniciar (banco novo). O aceite territorial está vinculado ao cadastro anterior; a comparação ficará vazia até nova decisão do usuário. Agregados BR/UF continuam funcionando.
- **Erros de validação em `recentErrors`:** corpo rejeitado não entra no acervo. Não contornar; registrar e analisar.
- **Painel lento na aba Comparação:** primeira chamada ~2 s (carga do histórico), seguintes ~0,3 s. A coleta roda em outro processo e não é afetada.

## Durante a noite

- [ ] `pnpm backup official` a cada ~1 h (seguro com o coletor rodando).
- [ ] Conferir periodicamente se `Coletor ativo` continua no painel.

## Encerramento

- [ ] Ctrl+C no terminal 2 (drena requisições em voo, libera lease e lock); depois no terminal 1.
- [ ] `pnpm backup official` final.
- [ ] Registrar em `VALIDACAO.md`: horário, requisições, erros/bloqueios, cobertura final de ZEs e se a coleta e a conciliação nacional oficial foram comprovadas. Isso só pode ser declarado com base no que o acervo oficial efetivamente registrou.

## Limites conhecidos

- O lock impede dois coletores nesta máquina, não em outras máquinas atrás do mesmo IP.
- Governador não tem comparação histórica; série presidencial somente.
- Exterior (`ZZ`) e as 61 ZEs incompatíveis ficam fora da coorte, com exclusão explícita.
- Pintura do mapa é por município/UF; contagens zonais ficam no painel e na tabela.
