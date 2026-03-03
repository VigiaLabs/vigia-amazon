import { z } from 'zod';

// Hazard schema
export const HazardSchema = z.object({
  id: z.string().uuid(),
  geohash: z.string().length(7),
  lat: z.number(),
  lon: z.number(),
  type: z.enum(['POTHOLE', 'DEBRIS', 'FLOODING', 'ACCIDENT']),
  severity: z.number().int().min(1).max(5),
  timestamp: z.number(),
  signature: z.string(),
  contributorId: z.string(),
  frameHash: z.string().optional(),
});

export type Hazard = z.infer<typeof HazardSchema>;

// Coverage schema
export const CoverageSchema = z.object({
  type: z.enum(['city', 'region', 'neighborhood', 'custom']),
  name: z.string(),
  boundingBox: z.object({
    north: z.number(),
    south: z.number(),
    east: z.number(),
    west: z.number(),
  }),
  centerPoint: z.object({
    lat: z.number(),
    lon: z.number(),
    geohash: z.string(),
  }),
  geohashPrecision: z.number().int().min(5).max(9),
  geohashTiles: z.array(z.string()),
  areaKm2: z.number(),
});

// Temporal schema
export const TemporalSchema = z.object({
  captureStart: z.number(),
  captureEnd: z.number(),
  createdAt: z.number(),
  finalizedAt: z.number().optional(),
  duration: z.number(),
  status: z.enum(['collecting', 'finalized', 'archived']),
});

// Location schema
export const LocationSchema = z.object({
  continent: z.string(),
  country: z.string(),
  state: z.string(),
  region: z.string(),
  city: z.string(),
  neighborhood: z.string().optional(),
});

// MapFile schema (enhanced)
export const MapFileSchema = z.object({
  version: z.literal('1.0'),
  sessionId: z.string(),
  displayName: z.string(),
  coverage: CoverageSchema,
  temporal: TemporalSchema,
  location: LocationSchema,
  hazards: z.array(HazardSchema),
  metadata: z.object({
    totalHazards: z.number(),
    hazardsByType: z.record(z.string(), z.number()),
    severityDistribution: z.record(z.string(), z.number()),
    contributors: z.array(z.string()),
    dataSource: z.enum(['manual', 'video', 'import']),
    tags: z.array(z.string()),
  }),
});

export type MapFile = z.infer<typeof MapFileSchema>;

// Legacy MapFile schema (for migration)
export const LegacyMapFileSchema = z.object({
  version: z.literal('1.0'),
  sessionId: z.string(),
  timestamp: z.number(),
  hazards: z.array(HazardSchema),
  metadata: z.object({
    totalHazards: z.number(),
    geohashBounds: z.array(z.string()),
    contributors: z.array(z.string()),
  }),
});

export type LegacyMapFile = z.infer<typeof LegacyMapFileSchema>;

// ScenarioBranch schema (simulation data)
export const ScenarioBranchSchema = MapFileSchema.extend({
  parentMapId: z.string(),
  branchId: z.string().uuid(),
  branchName: z.string(),
  simulatedChanges: z.object({
    addedHazards: z.array(HazardSchema),
    removedHazards: z.array(z.string().uuid()),
    modifiedSeverity: z.array(z.object({
      id: z.string().uuid(),
      newSeverity: z.number().int().min(1).max(5),
    })),
  }),
  routingResults: z.object({
    baselineAvgLatency: z.number(),
    branchAvgLatency: z.number(),
    affectedRoutes: z.number(),
    computedAt: z.number(),
  }).optional(),
});

export type ScenarioBranch = z.infer<typeof ScenarioBranchSchema>;

// Diff result types
export interface DiffResult {
  fileA: { sessionId: string; timestamp: number };
  fileB: { sessionId: string; timestamp: number };
  changes: {
    new: Hazard[];
    fixed: Hazard[];
    worsened: Array<{ before: Hazard; after: Hazard }>;
    unchanged: Hazard[];
  };
  summary: {
    totalNew: number;
    totalFixed: number;
    totalWorsened: number;
    netChange: number;
  };
}
