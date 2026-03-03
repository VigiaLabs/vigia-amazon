import type { MapFile } from './mapFile';
import type { DiffMapFile } from './diffMap';
import { v4 as uuidv4 } from 'uuid';

/**
 * Compute diff between two MapFile sessions
 * Returns a DiffMapFile for temporal analysis
 */
export function computeMapDiff(sessionA: MapFile, sessionB: MapFile): DiffMapFile {
  const hazardsA = new Map(sessionA.hazards.map(h => [h.geohash, h]));
  const hazardsB = new Map(sessionB.hazards.map(h => [h.geohash, h]));
  
  const newHazards: DiffMapFile['changes']['newHazards'] = [];
  const fixedHazards: DiffMapFile['changes']['fixedHazards'] = [];
  const worsenedHazards: DiffMapFile['changes']['worsenedHazards'] = [];
  const unchangedHazards: DiffMapFile['changes']['unchangedHazards'] = [];
  
  // Find new hazards (in B but not in A)
  for (const [geohash, hazardB] of hazardsB) {
    if (!hazardsA.has(geohash)) {
      newHazards.push({
        hazardId: hazardB.id || geohash,
        type: hazardB.type,
        severity: hazardB.severity,
        lat: hazardB.lat,
        lon: hazardB.lon,
        geohash,
      });
    }
  }
  
  // Find fixed hazards (in A but not in B)
  for (const [geohash, hazardA] of hazardsA) {
    if (!hazardsB.has(geohash)) {
      fixedHazards.push({
        hazardId: hazardA.id || geohash,
        type: hazardA.type,
        severity: hazardA.severity,
        lat: hazardA.lat,
        lon: hazardA.lon,
        geohash,
      });
    }
  }
  
  // Find worsened/unchanged hazards (in both)
  for (const [geohash, hazardA] of hazardsA) {
    const hazardB = hazardsB.get(geohash);
    if (hazardB) {
      if (hazardB.severity > hazardA.severity) {
        worsenedHazards.push({
          hazardId: hazardA.id || geohash,
          type: hazardA.type,
          oldSeverity: hazardA.severity,
          newSeverity: hazardB.severity,
          lat: hazardA.lat,
          lon: hazardA.lon,
          geohash,
        });
      } else {
        unchangedHazards.push({
          hazardId: hazardA.id || geohash,
          type: hazardA.type,
          severity: hazardA.severity,
          lat: hazardA.lat,
          lon: hazardA.lon,
          geohash,
        });
      }
    }
  }
  
  // Calculate summary statistics
  const totalNew = newHazards.length;
  const totalFixed = fixedHazards.length;
  const totalWorsened = worsenedHazards.length;
  const totalUnchanged = unchangedHazards.length;
  const netChange = totalNew - totalFixed + totalWorsened;
  
  // Calculate degradation score (0-100)
  const totalHazards = hazardsA.size + hazardsB.size;
  const degradationScore = totalHazards > 0
    ? Math.min(100, Math.max(0, ((netChange / totalHazards) * 100) + 50))
    : 50;
  
  // Calculate time span
  const timeA = (sessionA as any).timestamp || sessionA.temporal?.createdAt || 0;
  const timeB = (sessionB as any).timestamp || sessionB.temporal?.createdAt || 0;
  const timeSpanDays = Math.abs(timeB - timeA) / (1000 * 60 * 60 * 24);
  
  const diffId = uuidv4();
  const displayName = `${sessionA.displayName || sessionA.location?.city}-vs-${sessionB.displayName || sessionB.location?.city}`;
  
  return {
    version: '1.0',
    diffId,
    displayName,
    createdAt: Date.now(),
    sessionA: {
      sessionId: sessionA.sessionId,
      displayName: sessionA.displayName || `${sessionA.location?.city}`,
      timestamp: timeA,
      location: sessionA.location,
      coverage: sessionA.coverage,
    },
    sessionB: {
      sessionId: sessionB.sessionId,
      displayName: sessionB.displayName || `${sessionB.location?.city}`,
      timestamp: timeB,
      location: sessionB.location,
      coverage: sessionB.coverage,
    },
    changes: {
      newHazards,
      fixedHazards,
      worsenedHazards,
      unchangedHazards,
    },
    summary: {
      totalNew,
      totalFixed,
      totalWorsened,
      totalUnchanged,
      netChange,
      degradationScore,
      timeSpanDays,
    },
  };
}
