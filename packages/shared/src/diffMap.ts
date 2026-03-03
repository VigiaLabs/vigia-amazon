import { z } from 'zod';
import type { MapFile } from './mapFile';

/**
 * DiffMapFile (.dmap) - Comparison between two MapFile snapshots
 * Used for temporal analysis of road infrastructure changes
 */

export interface DiffMapFile {
  version: '1.0';
  diffId: string;
  displayName: string;
  createdAt: number;
  
  // Source sessions
  sessionA: {
    sessionId: string;
    displayName: string;
    timestamp: number;
    location: MapFile['location'];
    coverage: MapFile['coverage'];
  };
  
  sessionB: {
    sessionId: string;
    displayName: string;
    timestamp: number;
    location: MapFile['location'];
    coverage: MapFile['coverage'];
  };
  
  // Diff analysis
  changes: {
    newHazards: Array<{
      hazardId: string;
      type: string;
      severity: number;
      lat: number;
      lon: number;
      geohash: string;
    }>;
    
    fixedHazards: Array<{
      hazardId: string;
      type: string;
      severity: number;
      lat: number;
      lon: number;
      geohash: string;
    }>;
    
    worsenedHazards: Array<{
      hazardId: string;
      type: string;
      oldSeverity: number;
      newSeverity: number;
      lat: number;
      lon: number;
      geohash: string;
    }>;
    
    unchangedHazards: Array<{
      hazardId: string;
      type: string;
      severity: number;
      lat: number;
      lon: number;
      geohash: string;
    }>;
  };
  
  // Summary statistics
  summary: {
    totalNew: number;
    totalFixed: number;
    totalWorsened: number;
    totalUnchanged: number;
    netChange: number; // positive = degradation, negative = improvement
    degradationScore: number; // 0-100 scale
    timeSpanDays: number;
  };
  
  // Agent analysis
  agentAnalysis?: {
    traceId: string;
    summary: string;
    degradationAssessment: string;
    recommendations: string[];
    confidence: number;
    analyzedAt: number;
  };
}

export const DiffMapFileSchema = z.object({
  version: z.literal('1.0'),
  diffId: z.string(),
  displayName: z.string(),
  createdAt: z.number(),
  sessionA: z.object({
    sessionId: z.string(),
    displayName: z.string(),
    timestamp: z.number(),
    location: z.any(),
    coverage: z.any(),
  }),
  sessionB: z.object({
    sessionId: z.string(),
    displayName: z.string(),
    timestamp: z.number(),
    location: z.any(),
    coverage: z.any(),
  }),
  changes: z.object({
    newHazards: z.array(z.any()),
    fixedHazards: z.array(z.any()),
    worsenedHazards: z.array(z.any()),
    unchangedHazards: z.array(z.any()),
  }),
  summary: z.object({
    totalNew: z.number(),
    totalFixed: z.number(),
    totalWorsened: z.number(),
    totalUnchanged: z.number(),
    netChange: z.number(),
    degradationScore: z.number(),
    timeSpanDays: z.number(),
  }),
  agentAnalysis: z.object({
    traceId: z.string(),
    summary: z.string(),
    degradationAssessment: z.string(),
    recommendations: z.array(z.string()),
    confidence: z.number(),
    analyzedAt: z.number(),
  }).optional(),
});

export type DiffMapFileType = z.infer<typeof DiffMapFileSchema>;
