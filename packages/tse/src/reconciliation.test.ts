import { expect, it } from 'vitest';
import { structuralReconciliation } from './reconciliation';
it('interseção de segmentos não promove ZE com composição diferente ou exterior', () => {
  const a = { uf: 'ac', municipality: '00001', zone: '0001' },
    b = { ...a, municipality: '00002' },
    zz = { ...a, uf: 'zz' };
  const r = structuralReconciliation([a, b, zz], [a, zz], [a, b, zz]);
  expect(r.directSegmentsBothYears).toBe(2);
  expect(r.compatibleDomesticZones).toBe(0);
  expect(r.verified).toBe(0);
  expect(r.details[0].status).toBe('uncertain');
  expect(r.exteriorSegments).toBe(1);
  expect(() => structuralReconciliation([a, a], [a], [a])).toThrow('duplicado');
});
it('ZE multissegmento exige soma completa nos três anos, ainda pendente de auditoria', () => {
  const rows = [
    { uf: 'ac', municipality: '00001', zone: '0001' },
    { uf: 'ac', municipality: '00002', zone: '0001' },
  ];
  const r = structuralReconciliation(rows, rows, rows);
  expect(r).toMatchObject({
    directPercent: 100,
    compatibleDomesticZones: 1,
    compatibleDomesticSegments: 2,
    multiSegmentDomesticZones: 1,
    verified: 0,
  });
  expect(r.details[0].status).toBe('review');
});
