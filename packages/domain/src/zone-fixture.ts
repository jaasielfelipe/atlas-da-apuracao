import { type ZoneDataset, type ZoneResult, years, segmentId } from './zones';

export const zoneCaptures = [0, 1, 2, 3, 4].map(
  (i) => `2026-10-02T17:${String(i * 10).padStart(2, '0')}:00.000Z`,
);
/** Entirely synthetic: identifiers demonstrate the algorithm, not historical concordance. */
export function zoneFixture(step = 4): ZoneDataset {
  const dataset: ZoneDataset = {
    environment: 'fixture',
    capturedAt: zoneCaptures[0],
    registryDigest: 'synthetic-registry-v1',
    registryComplete: true,
    segments: [
      { uf: 'ac', municipality: '01120', zone: '0008' },
      { uf: 'ac', municipality: '01511', zone: '0008' },
      { uf: 'ac', municipality: '01538', zone: '0008' },
      { uf: 'ac', municipality: '01023', zone: '0001' },
      { uf: 'ac', municipality: '01392', zone: '0001' },
      { uf: 'ac', municipality: '01392', zone: '0009' },
    ],
    results: [],
    matches: [],
    mappings: {
      2018: { bolsonaro: 'B18', lula_haddad: 'L18' },
      2022: { bolsonaro: 'B22', lula_haddad: 'L22' },
      2026: { bolsonaro: 'B26', lula_haddad: 'L26' },
    },
  };
  dataset.segments.forEach((segment, index) => {
    const key = segmentId(segment);
    dataset.matches.push({
      id: `match:${key}`,
      current: key,
      historical2018: key,
      historical2022: key,
      status: 'verified',
      capturedAt: zoneCaptures[0],
      method: 'Correspondência sintética explícita; não comprova territórios reais',
      evidence: 'zone-fixture.ts',
      registryDigest: dataset.registryDigest,
    });
    for (const year of years) {
      for (let capture = 0; capture <= (year === 2026 ? step : 0); capture++) {
        const complete = year !== 2026 || capture >= (index < 2 ? 0 : index === 2 ? 1 : 2);
        const correction = year === 2026 && capture === 3 && index === 2;
        const votes =
          year === 2018
            ? [60, 30, 10]
            : year === 2022
              ? [25, 25, 50]
              : index >= 3
                ? [40, 40, 20]
                : [30, 60, 10];
        const multiplier = index + 1;
        const mapping = dataset.mappings[year];
        const result: ZoneResult = {
          ...segment,
          id: `${year}:${key}:${capture}`,
          environment: 'fixture',
          year,
          election: `fixture-${year}`,
          round: '1',
          capturedAt: zoneCaptures[capture],
          sourceUrl: `fixture://zones/${year}/${key}/${capture}`,
          sourceDigest: `synthetic-${year}-${key}-${capture}`,
          status: complete && !correction ? 'complete' : 'partial',
          total: 10,
          totalized: complete && !correction ? 10 : 9,
          notTotalized: complete && !correction ? 0 : 1,
          valid: 100 * multiplier,
          candidates: [mapping.bolsonaro, mapping.lula_haddad, `O${year}`].map((id, i) => ({
            id,
            votes: votes[i] * multiplier,
          })),
        };
        dataset.results.push(result);
      }
    }
  });
  return dataset;
}
