'use client';

import { useEffect, useRef, useState } from 'react';
import { RouteState } from '@/types';
import { generateMockRoute } from '@/lib/mockData';

interface MapLibreMapProps {
  coordinates: [number, number];
  zoom: number;
  cityName: string;
  routeState: RouteState | undefined;
}

// ─────────────────────────────────────────────
// MapLibreMap — Wrapper for MapLibre GL JS
// ─────────────────────────────────────────────

export function MapLibreMap({ coordinates, zoom, cityName, routeState }: MapLibreMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let isMounted = true;

    async function initMap() {
      try {
        const maplibregl = (await import('maplibre-gl')).default;

        // Dark map style — free OpenMapTiles / MapTiler compatible style
        const style = {
          version: 8 as const,
          sources: {
            'osm-tiles': {
              type: 'raster' as const,
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution: '© OpenStreetMap',
              maxzoom: 19,
            },
          },
          layers: [
            {
              id: 'background',
              type: 'background' as const,
              paint: { 'background-color': '#0E1117' },
            },
            {
              id: 'osm-tiles-layer',
              type: 'raster' as const,
              source: 'osm-tiles',
              paint: {
                'raster-opacity': 0.85,
                'raster-brightness-min': 0.0,
                'raster-brightness-max': 0.25,
                'raster-saturation': -0.9,
                'raster-contrast': 0.15,
                'raster-hue-rotate': 200,
              },
            },
          ],
        };

        const map = new maplibregl.Map({
          container: containerRef.current!,
          style,
          center: coordinates,
          zoom,
          attributionControl: false,
        });

        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

        map.on('load', () => {
          if (!isMounted) return;

          // Add route sources (empty initially)
          map.addSource('route-fastest', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          });
          map.addSource('route-safest', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          });

          // Route layers
          map.addLayer({
            id: 'route-fastest-casing',
            type: 'line',
            source: 'route-fastest',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': '#1D4ED8', 'line-width': 8, 'line-opacity': 0.3 },
          });
          map.addLayer({
            id: 'route-fastest-line',
            type: 'line',
            source: 'route-fastest',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': '#3B82F6', 'line-width': 3.5, 'line-opacity': 0.95 },
          });
          map.addLayer({
            id: 'route-safest-casing',
            type: 'line',
            source: 'route-safest',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': '#065F46', 'line-width': 8, 'line-opacity': 0.25 },
          });
          map.addLayer({
            id: 'route-safest-line',
            type: 'line',
            source: 'route-safest',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
              'line-color': '#10B981',
              'line-width': 3,
              'line-opacity': 0.9,
              'line-dasharray': [6, 3],
            },
          });

          mapRef.current = map;
          setMapReady(true);
        });

        return map;
      } catch (err) {
        console.error('Failed to load MapLibre GL:', err);
      }
    }

    initMap();

    return () => {
      isMounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        setMapReady(false);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fly to new coordinates when city changes
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    mapRef.current.flyTo({
      center: coordinates,
      zoom,
      speed: 1.2,
      curve: 1.4,
    });
  }, [coordinates, zoom, mapReady]);

  // Draw / clear routes when calculated
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;

    const fastestSource = mapRef.current.getSource('route-fastest');
    const safestSource = mapRef.current.getSource('route-safest');

    if (!fastestSource || !safestSource) return;

    if (routeState?.calculated) {
      const fastest = generateMockRoute(coordinates, 'fastest');
      const safest = generateMockRoute(coordinates, 'safest');
      fastestSource.setData({ type: 'FeatureCollection', features: [fastest] });
      safestSource.setData({ type: 'FeatureCollection', features: [safest] });
    } else {
      fastestSource.setData({ type: 'FeatureCollection', features: [] });
      safestSource.setData({ type: 'FeatureCollection', features: [] });
    }
  }, [routeState?.calculated, coordinates, mapReady]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />

      {/* Loading overlay */}
      {!mapReady && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: '#0E1117' }}
        >
          <div className="flex flex-col items-center gap-3">
            <div
              className="w-8 h-8 border-2 border-accent-blue-bright rounded-full animate-spin"
              style={{ borderTopColor: 'transparent' }}
            />
            <span className="text-text-muted" style={{ fontSize: '0.72rem', fontFamily: 'JetBrains Mono, monospace' }}>
              Loading {cityName}...
            </span>
          </div>
        </div>
      )}

      {/* Map overlays */}
      {mapReady && (
        <div
          className="absolute top-2 left-2 flex flex-col gap-1"
          style={{ pointerEvents: 'none' }}
        >
          {/* City label */}
          <div
            className="flex items-center gap-2 px-2 py-1 rounded"
            style={{
              background: 'rgba(14,17,23,0.85)',
              border: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(4px)',
            }}
          >
            <span
              className="text-text-secondary font-mono"
              style={{ fontSize: '0.68rem', fontFamily: 'JetBrains Mono, monospace' }}
            >
              {cityName.toUpperCase()}
            </span>
          </div>
        </div>
      )}

      {/* Route legend */}
      {mapReady && routeState?.calculated && (
        <div
          className="absolute bottom-2 left-2"
          style={{ pointerEvents: 'none' }}
        >
          <div
            className="rounded p-2 flex flex-col gap-1.5"
            style={{
              background: 'rgba(14,17,23,0.88)',
              border: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(4px)',
            }}
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-0.5 rounded" style={{ background: '#3B82F6' }} />
              <span className="text-text-secondary" style={{ fontSize: '0.68rem' }}>
                Fastest
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-0.5 rounded"
                style={{ background: '#10B981', borderTop: '1px dashed #10B981' }}
              />
              <span className="text-text-secondary" style={{ fontSize: '0.68rem' }}>
                Safest
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
