import { createHash } from 'node:crypto';

/** Semicolon CSV with escaped quotes, CRLF and quoted newlines. No locale/numeric ID coercion. */
export function* csvRecords(text: string): Generator<string[]> {
  let field = '',
    row: string[] = [],
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === ';' && !quoted) {
      row.push(field);
      field = '';
    } else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      if (row.some((v) => v !== '')) yield row;
      row = [];
      field = '';
    } else field += c;
  }
  if (quoted) throw Error('CSV truncado');
  if (field || row.length) {
    row.push(field);
    yield row;
  }
}
export type HistoricalSegment = {
  uf: string;
  municipality: string;
  zone: string;
  valid: number;
  candidates: { id: string; number: string; name: string; votes: number }[];
};
export function importNominalHistory(bytes: Uint8Array, year: 2018 | 2022) {
  const records = csvRecords(new TextDecoder('windows-1252', { fatal: true }).decode(bytes));
  const header = records.next().value as string[] | undefined;
  const required = [
    'ANO_ELEICAO',
    'CD_TIPO_ELEICAO',
    'NR_TURNO',
    'CD_ELEICAO',
    'SG_UF',
    'CD_MUNICIPIO',
    'NR_ZONA',
    'CD_CARGO',
    'SQ_CANDIDATO',
    'NR_CANDIDATO',
    'NM_CANDIDATO',
    'ST_VOTO_EM_TRANSITO',
    'QT_VOTOS_NOMINAIS',
    'NM_TIPO_DESTINACAO_VOTOS',
    'QT_VOTOS_NOMINAIS_VALIDOS',
  ];
  if (
    !header ||
    new Set(header).size !== header.length ||
    required.some((c) => !header.includes(c))
  )
    throw Error('Schema histórico desconhecido');
  const index = Object.fromEntries(header.map((c, i) => [c, i]));
  const seen = new Set<string>(),
    segments = new Map<string, HistoricalSegment>(),
    elections = new Set<string>(),
    destinations = new Set<string>();
  let imported = 0,
    skipped = 0;
  const identifier = (v: string, length: number) => {
    if (!/^\d+$/.test(v) || v.length > length) throw Error('ID histórico inválido');
    return v.padStart(length, '0');
  };
  const count = (v: string) => {
    if (!/^\d+$/.test(v) || !Number.isSafeInteger(Number(v)))
      throw Error('Contagem histórica inválida');
    return Number(v);
  };
  for (const row of records) {
    if (row.length !== header.length) throw Error('Linha histórica incompatível');
    const get = (c: string) => row[index[c]];
    if (get('ANO_ELEICAO') !== String(year)) throw Error('Ano histórico incompatível');
    if (get('NR_TURNO') !== '1' || get('CD_CARGO') !== '1' || get('CD_TIPO_ELEICAO') !== '2') {
      skipped++;
      continue;
    }
    const uf = get('SG_UF').toLowerCase(),
      municipality = identifier(get('CD_MUNICIPIO'), 5),
      zone = identifier(get('NR_ZONA'), 4);
    if (!/^[a-z]{2}$/.test(uf)) throw Error('UF histórica inválida');
    const id = get('SQ_CANDIDATO'),
      transit = get('ST_VOTO_EM_TRANSITO');
    if (!/^\d+$/.test(id) || !['N', 'S'].includes(transit))
      throw Error('Candidatura/partição histórica inválida');
    const key = `${uf}:${municipality}:${zone}`,
      rowKey = `${key}:${id}:${transit}`;
    if (seen.has(rowKey)) throw Error('Linha histórica duplicada');
    seen.add(rowKey);
    const votes = count(get('QT_VOTOS_NOMINAIS_VALIDOS')),
      nominal = count(get('QT_VOTOS_NOMINAIS')),
      destination = get('NM_TIPO_DESTINACAO_VOTOS');
    if (
      !['Válido', 'Anulado', 'Anulado sub judice'].includes(destination) ||
      votes > nominal ||
      (destination !== 'Válido' && votes !== 0) ||
      (destination === 'Válido' && votes !== nominal)
    )
      throw Error('Destinação histórica não conciliada');
    destinations.add(destination);
    elections.add(get('CD_ELEICAO'));
    imported++;
    const segment = segments.get(key) ?? { uf, municipality, zone, valid: 0, candidates: [] };
    const existing = segment.candidates.find((c) => c.id === id);
    if (
      existing &&
      (existing.number !== get('NR_CANDIDATO') || existing.name !== get('NM_CANDIDATO'))
    )
      throw Error('Identidade histórica inconsistente');
    if (existing) existing.votes += votes;
    else
      segment.candidates.push({
        id,
        number: get('NR_CANDIDATO'),
        name: get('NM_CANDIDATO'),
        votes,
      });
    segment.valid += votes;
    if (!Number.isSafeInteger(segment.valid)) throw Error('Soma histórica insegura');
    segments.set(key, segment);
  }
  if (elections.size !== 1 || !imported) throw Error('Eleição histórica não unívoca');
  return {
    year,
    election: [...elections][0],
    encoding: 'windows-1252',
    sha256: createHash('sha256').update(bytes).digest('hex'),
    imported,
    skipped,
    destinations: [...destinations],
    segments: [...segments.values()],
  };
}

/** Structural equality is only a prerequisite. A human/source audit of reorganizations is mandatory. */
export function reconcileZone(
  current: string[],
  historical2018: string[],
  historical2022: string[],
  audit?: { method: string; evidence: string; reorganizationsChecked: boolean },
) {
  const canonical = (ids: string[]) => [...ids].sort().join('|');
  if (
    [current, historical2018, historical2022].some(
      (ids) => !ids.length || new Set(ids).size !== ids.length,
    )
  )
    return { status: 'unmatched' as const, reason: 'Cadastro vazio ou duplicado' };
  if (
    canonical(current) !== canonical(historical2018) ||
    canonical(current) !== canonical(historical2022)
  )
    return { status: 'uncertain' as const, reason: 'Composição municipal incompatível' };
  if (!audit?.reorganizationsChecked || !audit.method || !audit.evidence)
    return {
      status: 'review' as const,
      reason: 'Igualdade cadastral não comprova ausência de reorganização',
    };
  return {
    status: 'verified' as const,
    reason: `${audit.method}: ${audit.evidence}; sem afirmar identidade de seções ou eleitores`,
  };
}
