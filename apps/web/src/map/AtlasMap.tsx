import { useEffect, useRef, useState } from 'react';
import maplibregl, { type GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { FeatureCollection, Geometry } from 'geojson';
import type { Layer, Snapshot, Territory } from '../../../../packages/domain/src/index';
import { candidateColor, percent } from '../format';
// IBGE UF codes (fixed by IBGE); the TSE catalog carries IBGE codes only for municipalities.
const UF_IBGE: Record<string, string> = {
  ro: '11',
  ac: '12',
  am: '13',
  rr: '14',
  pa: '15',
  ap: '16',
  to: '17',
  ma: '21',
  pi: '22',
  ce: '23',
  rn: '24',
  pb: '25',
  pe: '26',
  al: '27',
  se: '28',
  ba: '29',
  mg: '31',
  es: '32',
  rj: '33',
  sp: '35',
  pr: '41',
  sc: '42',
  rs: '43',
  ms: '50',
  mt: '51',
  go: '52',
  df: '53',
};
const ibge = (t: Territory) => t.ibgeCode ?? (t.kind === 'uf' ? UF_IBGE[t.id] : undefined);
type Props = {
  selected: Territory;
  territories: Territory[];
  rows: { territoryId: string; snapshot: Snapshot | null }[];
  layer: Layer;
  onSelect: (id: string) => void;
  /** Live data: municipal meshes for every UF and ranking-based colors. Fixture: Acre only. */
  live?: boolean;
  ranking?: string[];
  attribution?: string;
};
export default function AtlasMap({
  selected,
  territories,
  rows,
  layer,
  onSelect,
  live = false,
  ranking,
  attribution = 'Fixture sintética',
}: Props) {
  const element = useRef<HTMLDivElement>(null),
    map = useRef<maplibregl.Map | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const [ready, setReady] = useState(false),
    [error, setError] = useState(''),
    [size, setSize] = useState('');
  const [hover, setHover] = useState<{ name: string; metric: string } | null>(null);
  const [collections, setCollections] = useState<Record<string, FeatureCollection>>({});
  // DF has no municipal subdivision in the TSE catalog; exterior has no IBGE mesh.
  const municipal =
    selected.kind !== 'br' &&
    !!selected.uf &&
    (live ? !['df', 'zz'].includes(selected.uf) : selected.uf === 'ac');
  const meshName = municipal ? `${selected.uf}-municipalities` : 'br-ufs';
  const ufName = territories.find((t) => t.kind === 'uf' && t.id === selected.uf)?.name;
  useEffect(() => {
    if (collections[meshName]) return;
    const controller = new AbortController();
    fetch(`/maps/${meshName}.geojson`, { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw Error('Malha local indisponível');
        const body = (await r.json()) as FeatureCollection;
        setCollections((c) => ({ ...c, [meshName]: body }));
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      });
    return () => controller.abort();
  }, [meshName, collections]);
  useEffect(() => {
    if (!element.current) return;
    let m: maplibregl.Map;
    try {
      m = new maplibregl.Map({
        container: element.current,
        attributionControl: false,
        style: {
          version: 8,
          sources: {},
          layers: [
            { id: 'background', type: 'background', paint: { 'background-color': '#eef1e9' } },
          ],
        },
        center: [-52, -14],
        zoom: 2.6,
        minZoom: 1.5,
        maxZoom: 12,
        renderWorldCopies: false,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
      });
    } catch {
      setError('WebGL indisponível. Use a seleção de territórios ao lado.');
      return;
    }
    map.current = m;
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    m.on('load', () => {
      m.addSource('territories', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      m.addLayer({
        id: 'areas',
        type: 'fill',
        source: 'territories',
        paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.82 },
      });
      m.addLayer({
        id: 'borders',
        type: 'line',
        source: 'territories',
        paint: { 'line-color': '#fafcf7', 'line-width': 1.1 },
      });
      m.addLayer({
        id: 'selected',
        type: 'line',
        source: 'territories',
        filter: ['==', ['get', 'selected'], true],
        paint: { 'line-color': '#194b46', 'line-width': 2.8 },
      });
      m.on('click', 'areas', (e) => {
        const id = e.features?.[0]?.properties?.territoryId;
        if (id) onSelectRef.current(id);
      });
      m.on('mousemove', 'areas', (e) => {
        m.getCanvas().style.cursor = 'pointer';
        const p = e.features?.[0]?.properties;
        if (p) setHover({ name: p.name, metric: p.metric });
      });
      m.on('mouseleave', 'areas', () => {
        m.getCanvas().style.cursor = '';
        setHover(null);
      });
      setReady(true);
    });
    m.on('error', () => setError('Não foi possível renderizar a malha local.'));
    const observer = new ResizeObserver((entries) => {
      m.resize();
      const rect = entries[0].contentRect;
      setSize(`${rect.width}:${rect.height}`);
    });
    observer.observe(element.current);
    return () => {
      observer.disconnect();
      m.remove();
      map.current = null;
      setReady(false);
    };
  }, []);
  useEffect(() => {
    const m = map.current,
      collection = collections[meshName];
    if (!ready || !m || !collection) return;
    const lookup = new Map(
      territories
        .filter((t) => (municipal ? t.kind === 'municipality' : t.kind === 'uf'))
        .map((t) => [ibge(t), t]),
    );
    const snapshots = new Map(rows.map((r) => [r.territoryId, r.snapshot]));
    const data: FeatureCollection = {
      type: 'FeatureCollection',
      features: collection.features.map((f) => {
        const t = lookup.get(String(f.properties?.codarea)),
          s = t ? snapshots.get(t.id) : null;
        const sorted = s?.candidates
          .filter((c) => c.validShare !== null)
          .sort((a, b) => b.validShare! - a.validShare!);
        const candidate = sorted?.[0];
        const coverage = s?.sections.share;
        const color =
          layer === 'comparison' || !s
            ? '#d3d7ce'
            : layer === 'coverage'
              ? coverage == null
                ? '#d3d7ce'
                : `hsl(165, 28%, ${88 - coverage * 53}%)`
              : candidate
                ? candidateColor(candidate.number, ranking)
                : '#e2e6db';
        const metric =
          layer === 'comparison'
            ? 'Comparação indisponível'
            : !s
              ? 'Sem snapshot neste instante'
              : layer === 'coverage'
                ? `${percent(coverage)} das seções totalizadas`
                : candidate
                  ? `${candidate.name} · ${percent(candidate.validShare)} dos válidos`
                  : 'Participação não definida';
        return {
          ...f,
          properties: {
            ...f.properties,
            territoryId: t?.id ?? '',
            name: t?.name ?? '',
            color,
            metric,
            selected: t?.id === selected.id,
          },
        };
      }),
    };
    (m.getSource('territories') as GeoJSONSource).setData(data);
  }, [ready, collections, meshName, municipal, selected, territories, rows, layer, ranking]);
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const collection = collections[meshName];
    if (!collection) return;
    const features =
      selected.kind === 'br' || municipal
        ? collection.features
        : collection.features.filter((f) => String(f.properties?.codarea) === ibge(selected));
    const bounds = new maplibregl.LngLatBounds();
    function add(coords: unknown): void {
      if (!Array.isArray(coords)) return;
      if (typeof coords[0] === 'number') bounds.extend(coords as [number, number]);
      else coords.forEach(add);
    }
    features.forEach((f) => {
      if ('coordinates' in f.geometry)
        add((f.geometry as Exclude<Geometry, { type: 'GeometryCollection' }>).coordinates);
    });
    if (!bounds.isEmpty())
      m.fitBounds(bounds, { padding: { top: 50, bottom: 35, left: 35, right: 35 }, duration: 0 });
  }, [ready, collections, meshName, selected.id, municipal, size]);
  return (
    <div className="map-wrap">
      <div
        ref={element}
        className="map-canvas"
        role="img"
        aria-label={`Mapa ${municipal ? `dos municípios de ${ufName ?? selected.uf}` : 'das unidades da federação'}`}
        data-testid="atlas-map"
        data-ready={ready && !!collections[meshName]}
      />
      <div className="map-caption">
        <span className="map-dot" />
        {municipal
          ? `Municípios · ${ufName ?? selected.uf?.toUpperCase()}`
          : 'Unidades da federação'}
        <small>Malha IBGE · dados locais</small>
      </div>
      {hover && (
        <div className="map-hover">
          <strong>{hover.name}</strong>
          <span>{hover.metric}</span>
        </div>
      )}
      {error && (
        <div className="map-error" role="status">
          {error}
        </div>
      )}
      {selected.kind !== 'br' && !municipal && !live && (
        <div className="map-scope">Malha municipal desta UF ainda não incluída nesta etapa.</div>
      )}
      <div className="map-attribution">Geometrias © IBGE · {attribution}</div>
    </div>
  );
}
