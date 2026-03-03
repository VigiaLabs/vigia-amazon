import { create } from 'zustand';
import type { MapFile, ScenarioBranch, DiffResult } from '@/types/shared';
import { mapFileDB } from '@/lib/storage/mapFileDB';

interface MapFileStore {
  files: Map<string, MapFile | ScenarioBranch>;
  activeFileId: string | null;
  diffState: DiffResult | null;
  isComputing: boolean;

  loadFiles: () => Promise<void>;
  loadFile: (file: File) => Promise<void>;
  setActiveFile: (id: string | null) => void;
  createBranch: (parentId: string, branchName?: string) => Promise<string>;
  computeDiff: (fileAId: string, fileBId: string) => Promise<void>;
  clearDiff: () => void;
  updateBranchChanges: (branchId: string, changes: ScenarioBranch['simulatedChanges']) => Promise<void>;
  saveMapFile: (file: MapFile) => Promise<void>;
  deleteMapFile: (sessionId: string) => Promise<void>;
  getFilesByLocation: (country?: string, state?: string, city?: string) => MapFile[];
  getFilesByTimeRange: (startTime: number, endTime: number) => MapFile[];
  finalizeSession: (sessionId: string) => Promise<void>;
  getHierarchy: () => Record<string, Record<string, Record<string, MapFile[]>>>;
}

export const useMapFileStore = create<MapFileStore>((set, get) => ({
  files: new Map(),
  activeFileId: null,
  diffState: null,
  isComputing: false,

  loadFiles: async () => {
    const mapFiles = await mapFileDB.listMapFiles();
    const branches = await mapFileDB.listBranches();
    const allFiles = new Map<string, MapFile | ScenarioBranch>();

    mapFiles.forEach(f => allFiles.set(f.sessionId, f));
    branches.forEach(b => allFiles.set(b.branchId, b));

    set({ files: allFiles });
  },

  loadFile: async (file: File) => {
    const text = await file.text();
    const mapFile = JSON.parse(text) as MapFile;
    await mapFileDB.saveMapFile(mapFile);
    
    const { files } = get();
    files.set(mapFile.sessionId, mapFile);
    set({ files: new Map(files) });
  },

  setActiveFile: (id) => set({ activeFileId: id }),

  createBranch: async (parentId, branchName) => {
    const { files } = get();
    const parentFile = files.get(parentId) as MapFile;
    if (!parentFile) throw new Error('Parent file not found');

    const branch = {
      ...parentFile,
      parentMapId: parentFile.sessionId,
      branchId: crypto.randomUUID(),
      branchName: branchName || `Branch ${new Date().toLocaleString()}`,
      timestamp: Date.now(),
      simulatedChanges: {
        addedHazards: [],
        removedHazards: [],
        modifiedSeverity: [],
      },
    } as ScenarioBranch;

    await mapFileDB.saveBranch(branch);
    files.set(branch.branchId, branch);
    set({ files: new Map(files) });

    return branch.branchId;
  },

  computeDiff: async (fileAId, fileBId) => {
    set({ isComputing: true });

    const { files } = get();
    const fileA = files.get(fileAId) as MapFile;
    const fileB = files.get(fileBId) as MapFile;

    if (!fileA || !fileB) {
      set({ isComputing: false });
      throw new Error('Files not found');
    }

    // Use Web Worker for diff computation
    const worker = new Worker(new URL('@/workers/diffWorker.ts', import.meta.url));

    return new Promise<void>((resolve) => {
      worker.onmessage = (e) => {
        if (e.data.type === 'DIFF_RESULT') {
          set({ diffState: e.data.result, isComputing: false });
          worker.terminate();
          resolve();
        }
      };

      worker.postMessage({ type: 'COMPUTE_DIFF', fileA, fileB });
    });
  },

  clearDiff: () => set({ diffState: null }),

  updateBranchChanges: async (branchId, changes) => {
    const { files } = get();
    const branch = files.get(branchId) as ScenarioBranch;
    if (!branch) throw new Error('Branch not found');

    branch.simulatedChanges = changes;
    branch.timestamp = Date.now();
    await mapFileDB.saveBranch(branch);

    files.set(branchId, branch);
    set({ files: new Map(files) });
  },

  saveMapFile: async (file: MapFile) => {
    await mapFileDB.saveMapFile(file);
    const { files } = get();
    files.set(file.sessionId, file);
    set({ files: new Map(files) });
  },

  deleteMapFile: async (sessionId: string) => {
    await mapFileDB.deleteMapFile(sessionId);
    const { files } = get();
    files.delete(sessionId);
    set({ files: new Map(files) });
  },

  getFilesByLocation: (country?: string, state?: string, city?: string) => {
    const files = Array.from(get().files.values()).filter(
      (f): f is MapFile => 'coverage' in f
    );
    
    return files.filter(file => {
      if (city && file.location.city !== city) return false;
      if (state && file.location.state !== state) return false;
      if (country && file.location.country !== country) return false;
      return true;
    });
  },

  getFilesByTimeRange: (startTime: number, endTime: number) => {
    const files = Array.from(get().files.values()).filter(
      (f): f is MapFile => 'coverage' in f
    );
    
    return files.filter(file => 
      file.temporal.captureStart >= startTime && 
      file.temporal.captureStart <= endTime
    );
  },

  finalizeSession: async (sessionId: string) => {
    const { files } = get();
    const file = files.get(sessionId) as MapFile;
    if (!file || !('temporal' in file)) return;

    const updatedFile: MapFile = {
      ...file,
      temporal: {
        ...file.temporal,
        status: 'finalized',
        finalizedAt: Date.now(),
      },
    };

    await mapFileDB.saveMapFile(updatedFile);
    files.set(sessionId, updatedFile);
    set({ files: new Map(files) });
  },

  getHierarchy: () => {
    const files = Array.from(get().files.values()).filter(
      (f): f is MapFile => 'coverage' in f
    );
    
    const hierarchy: Record<string, Record<string, Record<string, MapFile[]>>> = {};
    
    files.forEach(file => {
      const { country, state, city } = file.location;
      
      if (!hierarchy[country]) hierarchy[country] = {};
      if (!hierarchy[country][state]) hierarchy[country][state] = {};
      if (!hierarchy[country][state][city]) hierarchy[country][state][city] = [];
      
      hierarchy[country][state][city].push(file);
    });
    
    // Sort files by capture start time (newest first)
    Object.values(hierarchy).forEach(states => {
      Object.values(states).forEach(cities => {
        Object.values(cities).forEach(cityFiles => {
          cityFiles.sort((a, b) => b.temporal.captureStart - a.temporal.captureStart);
        });
      });
    });
    
    return hierarchy;
  },
}));
