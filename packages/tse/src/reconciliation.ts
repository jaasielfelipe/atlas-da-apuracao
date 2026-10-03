import { segmentKey, zoneKey, type Segment } from './zones';
import { reconcileZone } from './history';

/** National structural inventory only. No equality of codes authorizes a verified match. */
export function structuralReconciliation(current: Segment[], y2018: Segment[], y2022: Segment[]) {
  const sets = [current, y2018, y2022].map((rows) => {
    const keys = new Set(rows.map(segmentKey));
    if (!rows.length || keys.size !== rows.length) throw Error('Cadastro vazio/duplicado');
    return keys;
  });
  const grouped = [current, y2018, y2022].map((rows) => {
    const groups = new Map<string, string[]>();
    for (const s of rows)
      groups.set(zoneKey(s), [...(groups.get(zoneKey(s)) ?? []), s.municipality]);
    return groups;
  });
  const zones = [...grouped[0]].map(([key, municipalities]) => {
    const h18 = grouped[1].get(key) ?? [],
      h22 = grouped[2].get(key) ?? [];
    return {
      key,
      municipalities,
      historical2018: h18,
      historical2022: h22,
      ...reconcileZone(municipalities, h18, h22),
      exterior: key.startsWith('zz:'),
      aggregationSegments: municipalities.length,
    };
  });
  const direct = current.filter((s) => sets[1].has(segmentKey(s)) && sets[2].has(segmentKey(s)));
  const compatible = zones.filter((z) => z.status === 'review' && !z.exterior);
  return {
    segments: current.length,
    zones: zones.length,
    directSegmentsBothYears: direct.length,
    directPercent: (100 * direct.length) / current.length,
    compatibleDomesticZones: compatible.length,
    compatibleDomesticSegments: compatible.reduce((n, z) => n + z.municipalities.length, 0),
    multiSegmentDomesticZones: compatible.filter((z) => z.municipalities.length > 1).length,
    verified: 0,
    exteriorSegments: current.filter((s) => s.uf === 'zz').length,
    absent2018: current.filter((s) => !sets[1].has(segmentKey(s))),
    absent2022: current.filter((s) => !sets[2].has(segmentKey(s))),
    historicalOnly2018: y2018.filter((s) => !sets[0].has(segmentKey(s))),
    historicalOnly2022: y2022.filter((s) => !sets[0].has(segmentKey(s))),
    details: zones,
  };
}
