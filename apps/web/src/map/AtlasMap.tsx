import { useEffect, useRef, useState } from 'react';
import maplibregl, { type GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { FeatureCollection, Geometry } from 'geojson';
import type { Layer, Snapshot, Territory } from '../../../../packages/domain/src/index';
import { candidateColor, percent } from '../format';
type Props = {
  selected: Territory;
  territories: Territory[];
  rows: { territoryId: string; snapshot: Snapshot | null }[];
  layer: Layer;
  onSelect: (id: string) => void;
};
export default function AtlasMap({ selected, territories, rows, layer, onSelect }: Props) {
  const element = useRef<HTMLDivElement>(null),
    map = useRef<maplibregl.Map | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const [ready, setReady] = useState(false),
    [error, setError] = useState(''),
    [size, setSize] = useState('');
  const [hover, setHover] = useState<{ name: string; metric: string } | null>(null);
  const [collections, setCollections] = useState<Record<string, FeatureCollection>>({});
  const municipal = selected.uf === 'ac' && selected.kind !== 'br';
  useEffect(() => {
    const controller = new AbortController();
    Promise.all(
      ['br-ufs', 'ac-municipalities'].map(async (name) => {
        const r = await fetch(`/maps/${name}.geojson`, { signal: controller.signal });
        if (!r.ok) throw Error('Malha local indisponível');
        return [name, await r.json()] as const;
      }),
    )
      .then((entries) => setCollections(Object.fromEntries(entries)))
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      });
    return () => controller.abort();
  }, []);
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
      collection = collections[municipal ? 'ac-municipalities' : 'br-ufs'];
    if (!ready || !m || !collection) return;
    const lookup = new Map(
      territories
        .filter((t) => (municipal ? t.kind === 'municipality' : t.kind === 'uf'))
        .map((t) => [t.ibgeCode, t]),
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
                ? candidateColor(candidate.number)
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
  }, [ready, collections, municipal, selected, territories, rows, layer]);
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const collection = collections[municipal ? 'ac-municipalities' : 'br-ufs'];
    if (!collection) return;
    const features =
      selected.kind === 'br' || municipal
        ? collection.features
        : collection.features.filter((f) => String(f.properties?.codarea) === selected.ibgeCode);
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
  }, [ready, collections, selected.id, municipal, size]);
  return (
    <div className="map-wrap">
      <div
        ref={element}
        className="map-canvas"
        role="img"
        aria-label={`Mapa ${municipal ? 'dos municípios do Acre' : 'das unidades da federação'}`}
        data-testid="atlas-map"
        data-ready={ready && Object.keys(collections).length > 0}
      />
      <div className="map-caption">
        <span className="map-dot" />
        {municipal ? 'Municípios do Acre' : 'Unidades da federação'}
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
      {selected.kind !== 'br' && !municipal && (
        <div className="map-scope">Malha municipal desta UF ainda não incluída nesta etapa.</div>
      )}
      <div className="map-attribution">Geometrias © IBGE · Fixture sintética</div>
    </div>
  );
}
