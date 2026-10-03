/** Everything that differs between the fixture demo and the live TSE environments. */
export type DashboardEnvironment = 'fixture' | 'official' | 'simulated';

export type EnvironmentConfig = {
  id: DashboardEnvironment;
  live: boolean;
  /** API prefix for the shared dashboard routes. */
  base: string;
  badge: string;
  tag: string;
  sourceLabel: string;
  footer: string;
  notice: { strong: string; text: string };
  sidebar: { eyebrow: string; text: string; hint: string };
  comparison: { available: boolean; summary: string; status: string };
  captureLabel: string;
};

export const environments: Record<DashboardEnvironment, EnvironmentConfig> = {
  fixture: {
    id: 'fixture',
    live: false,
    base: '/api/v1',
    badge: 'FIXTURE',
    tag: 'Fixture',
    sourceLabel: 'Fixture sintética',
    footer: 'sintético',
    notice: {
      strong: 'Ambiente de demonstração.',
      text: 'Números e horários sintéticos. Não são resultados oficiais.',
    },
    sidebar: {
      eyebrow: 'NESTA DEMONSTRAÇÃO',
      text: '27 UFs e municípios do Acre.',
      hint: 'Selecionar um município não inicia o monitoramento.',
    },
    comparison: {
      available: true,
      summary:
        'Demonstração sintética disponível abaixo. Históricos reais e conciliação nacional continuam pendentes.',
      status: 'Fixture ativa · coleta zonal nacional não validada',
    },
    captureLabel: 'Captura da fixture',
  },
  official: {
    id: 'official',
    live: true,
    base: '/api/v1/live/official',
    badge: 'OFICIAL TSE',
    tag: 'Oficial',
    sourceLabel: 'EA20 oficial TSE',
    footer: 'TSE oficial',
    notice: {
      strong: 'Capturas do ambiente oficial do TSE.',
      text: 'Resultados parciais conforme publicados; ausência de dado não significa zero.',
    },
    sidebar: {
      eyebrow: 'NESTE ACERVO',
      text: 'Malha municipal IBGE de todas as UFs.',
      hint: 'Salvar um município inicia a coleta do agregado municipal no coletor em execução.',
    },
    comparison: {
      available: true,
      summary:
        'Zonas eleitorais inteiras concluídas no oficial, com aceite territorial informado pelo usuário. Detalhes abaixo.',
      status: 'Históricos finais 2018/2022 · user_accepted_structural',
    },
    captureLabel: 'Captura local',
  },
  simulated: {
    id: 'simulated',
    live: true,
    base: '/api/v1/live/simulated',
    badge: 'SIMULADO TSE',
    tag: 'Simulado',
    sourceLabel: 'EA20 simulado TSE',
    footer: 'TSE simulado',
    notice: { strong: 'Ambiente simulado do TSE.', text: 'Não são resultados oficiais.' },
    sidebar: {
      eyebrow: 'NESTE ACERVO',
      text: 'Malha municipal IBGE de todas as UFs.',
      hint: 'Salvar um município inicia a coleta do agregado municipal no coletor em execução.',
    },
    comparison: {
      available: false,
      summary: 'Candidaturas simuladas não se vinculam às séries históricas oficiais.',
      status: 'Indisponível no simulado',
    },
    captureLabel: 'Captura local',
  },
};

/** Route → environment. `/` is the fixture demo; real data lives under `/live/<env>`. */
export function environmentFromPath(pathname: string): DashboardEnvironment {
  // `/official` and `/simulated` were the former archive pages; kept as aliases.
  if (pathname === '/live/official' || pathname === '/official') return 'official';
  if (pathname === '/live/simulated' || pathname === '/simulated') return 'simulated';
  return 'fixture';
}
