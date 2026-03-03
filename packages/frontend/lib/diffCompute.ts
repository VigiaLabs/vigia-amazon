/**
 * Inlined from @vigia/shared/diffCompute + @vigia/shared/diffMap
 * Avoids monorepo package resolution issues on AWS Amplify.
 */
import { v4 as uuidv4 } from 'uuid';

// ── DiffMapFile type ──────────────────────────────────────────────────────────

export interface DiffMapFile {
  version: '1.0';
  diffId: string;
  displayName: string;
  createdAt: number;
  sessionA: {
    sessionId: string;
    displayName: string;
    timestamp: number;
    location: any;
    coverage: any;
  };
  sessionB: {
    sessionId: string;
    displayName: string;
    timestamp: number;
    location: any;
    coverage: any;
  };
  changes: {
    newHazards: Array<{ hazardId: string; type: string; severity: number; lat: number; lon: number; geohash: string }>;
    fixedHazards: Array<{ hazardId: string; type: string; severity: number; lat: number; lon: number; geohash: string }>;
    worsenedHazards: Array<{ hazardId: string; type: string; oldSeverity: number; newSeverity: number; lat: number; lon: number; geohash: string }>;
    unchangedHazards: Array<{ hazardId: string; type: string; severity: number; lat: number; lon: number; geohash: string }>;
  };
  summary: {
    totalNew: number;
    totalFixed: number;
    totalWorsened: number;
    totalUnchanged: number;
    netChange: number;
    degradationScore: number;
    timeSpanDays: number;
  };
  agentAnalysis?: {
    traceId: string;
    summary: string;
    degradationAssessment: string;
    recommendations: string[];
    confidence: number;
    analyzedAt: number;
  };
}

// ── computeMapDiff ────────────────────────────────────────────────────────────

export function computeMapDiff(sessionA: any, sessionB: any): DiffMapFile {
  const hazardsA = new Map((sessionA.hazards ?? []).map((h: any) => [h.geohash, h]));
  const hazardsB = new Map((sessionB.hazards ?? []).map((h: any) => [h.geohash, h]));

  const newHazards: DiffMapFile['changes']['newHazards'] = [];
  const fixedHazards: DiffMapFile['changes']['fixedHazards'] = [];
  const worsenedHazards: DiffMapFile['changes']['worsenedHazards'] = [];
  const unchangedHazards: DiffMapFile['changes']['unchangedHazards'] = [];

  for (const [geohash, hazardB] of hazardsB as Map<string, any>) {
    if (!hazardsA.has(geohash)) {
      newHazards.push({ hazardId: hazardB.id || geohash, type: hazardB.type, severity: hazardB.severity, lat: hazardB.lat, lon: hazardB.lon, geohash });
    }
  }

  for (const [geohash, hazardA] of hazardsA as Map<string, any>) {
    const hazardB = (hazardsB as Map<string, any>).get(geohash);
    if (!hazardB) {
      fixedHazards.push({ hazardId: hazardA.id || geohash, type: hazardA.type, severity: hazardA.severity, lat: hazardA.lat, lon: hazardA.lon, geohash });
    } else if (hazardB.severity > hazardA.severity) {
      worsenedHazards.push({ hazardId: hazardA.id || geohash, type: hazardA.type, oldSeverity: hazardA.severity, newSeverity: hazardB.severity, lat: hazardA.lat, lon: hazardA.lon, geohash });
    } else {
      unchangedHazards.push({ hazardId: hazardA.id || geohash, type: hazardA.type, severity: hazardA.severity, lat: hazardA.lat, lon: hazardA.lon, geohash });
    }
  }

  const totalNew = newHazards.length;
  const totalFixed = fixedHazards.length;
  const totalWorsened = worsenedHazards.length;
  const totalUnchanged = unchangedHazards.length;
  const netChange = totalNew - totalFixed + totalWorsened;
  const totalHazards = hazardsA.size + hazardsB.size;
  const degradationScore = totalHazards > 0 ? Math.min(100, Math.max(0, ((netChange / totalHazards) * 100) + 50)) : 50;

  const timeA = sessionA.timestamp || sessionA.temporal?.createdAt || 0;
  const timeB = sessionB.timestamp || sessionB.temporal?.createdAt || 0;
  const timeSpanDays = Math.abs(timeB - timeA) / (1000 * 60 * 60 * 24);

  const displayName = `${sessionA.displayName || sessionA.location?.city || 'A'}-vs-${sessionB.displayName || sessionB.location?.city || 'B'}`;

  return {
    version: '1.0',
    diffId: uuidv4(),
    displayName,
    createdAt: Date.now(),
    sessionA: {
      sessionId: sessionA.sessionId,
      displayName: sessionA.displayName || sessionA.location?.city || '',
      timestamp: timeA,
      location: sessionA.location,
      coverage: sessionA.coverage,
    },
    sessionB: {
      sessionId: sessionB.sessionId,
      displayName: sessionB.displayName || sessionB.location?.city || '',
      timestamp: timeB,
      location: sessionB.location,
      coverage: sessionB.coverage,
    },
    changes: { newHazards, fixedHazards, worsenedHazards, unchangedHazards },
    summary: { totalNew, totalFixed, totalWorsened, totalUnchanged, netChange, degradationScore, timeSpanDays },
  };
}
