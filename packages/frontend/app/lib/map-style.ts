/**
 * Shared map style utilities — single source of truth for all map components.
 * Mirrors the approach from LiveMap: CSS filter applied to the canvas element
 * so the visual theme works with any tile source (AWS, OSM, etc.)
 */

import type { MapStyle } from '../components/SettingsContext';

export const MAP_FILTERS: Record<MapStyle, string> = {
  'dark-osm':  'brightness(0.82) saturate(0.50) hue-rotate(192deg) contrast(1.05)',
  'satellite': 'brightness(0.72) saturate(0.70) hue-rotate(160deg) contrast(1.08)',
  'terrain':   'brightness(0.75) saturate(0.55) hue-rotate(30deg)  contrast(1.06) sepia(0.12)',
  'minimal':   'brightness(0.60) saturate(0.20) contrast(1.10)',
};

/**
 * Applies the map style CSS filter to the canvas inside a map container element.
 * Safe to call repeatedly — no-ops if the canvas isn't present yet.
 */
export function applyMapFilter(
  containerEl: HTMLDivElement | HTMLElement | null,
  style: MapStyle,
) {
  if (!containerEl) return;
  const canvas = containerEl.querySelector('canvas') as HTMLCanvasElement | null;
  if (canvas) {
    canvas.style.filter = MAP_FILTERS[style];
    canvas.style.transition = 'filter 0.4s ease';
  }
}

/**
 * Returns the MapLibre style URL (AWS Location Service) or an OSM fallback
 * spec. Accepts the active MapStyle so per-style map names can be used when
 * environment variables are configured.
 */
export function getMapStyleUrl(style: MapStyle = 'dark-osm'): string | object {
  const apiKey   = process.env.NEXT_PUBLIC_LOCATION_API_KEY || '';
  const styleMapNames: Partial<Record<MapStyle, string>> = {
    satellite: process.env.NEXT_PUBLIC_MAP_NAME_SATELLITE || '',
    terrain:   process.env.NEXT_PUBLIC_MAP_NAME_TERRAIN   || '',
  };
  const OSM_STYLE = {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap',
        maxzoom: 19,
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#0A0E15' } },
      { id: 'osm-tiles',  type: 'raster', source: 'osm', paint: { 'raster-opacity': 1 } },
    ],
  };
  const specificMap = styleMapNames[style];
  if (specificMap && apiKey)
    return `https://maps.geo.us-east-1.amazonaws.com/maps/v0/maps/${specificMap}/style-descriptor?key=${apiKey}`;
  const defaultMap = process.env.NEXT_PUBLIC_MAP_NAME || '';
  if (defaultMap && apiKey)
    return `https://maps.geo.us-east-1.amazonaws.com/maps/v0/maps/${defaultMap}/style-descriptor?key=${apiKey}`;
  return OSM_STYLE as object;
}
