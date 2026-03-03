'use client';

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { DiffLayer } from './DiffLayer';
import { BranchLayer } from './BranchLayer';
import { useMapFileStore } from '@/stores/mapFileStore';
import { useSettings } from './SettingsContext';
import { applyMapFilter, getMapStyleUrl } from '../lib/map-style';

export function InnovationMapView() {
  const { settings } = useSettings();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const { activeFileId, files } = useMapFileStore();

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: getMapStyleUrl(settings.mapStyle) as any,
      center: [-122.4194, 37.7749], // San Francisco
      zoom: 12,
    });

    mapRef.current = map;

    map.on('load', () => {
      applyMapFilter(mapContainerRef.current, settings.mapStyle);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Reapply CSS filter whenever map style changes
  useEffect(() => {
    applyMapFilter(mapContainerRef.current, settings.mapStyle);
  }, [settings.mapStyle]);

  // Update map when active file changes
  useEffect(() => {
    if (!mapRef.current || !activeFileId) return;

    const file = files.get(activeFileId);
    if (!file || !file.hazards.length) return;

    // Fit bounds to hazards
    const bounds = new maplibregl.LngLatBounds();
    file.hazards.forEach(hazard => {
      const lng = parseFloat(hazard.geohash.substring(0, 3));
      const lat = parseFloat(hazard.geohash.substring(3));
      bounds.extend([lng, lat]);
    });

    mapRef.current.fitBounds(bounds, { padding: 50 });
  }, [activeFileId, files]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="w-full h-full" />
      <DiffLayer map={mapRef.current} />
      <BranchLayer map={mapRef.current} />
    </div>
  );
}
