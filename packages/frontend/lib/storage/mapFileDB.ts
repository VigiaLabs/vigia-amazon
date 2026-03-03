import type { MapFile, ScenarioBranch } from '@/types/shared';
import { isLegacyMapFile, migrateLegacyMapFile } from '@vigia/shared';

const DB_NAME = 'VigiaMapFiles';
const DB_VERSION = 3; // Increment for schema changes
const MAP_FILES_STORE = 'mapFiles';
const BRANCHES_STORE = 'branches';
const DIFF_MAPS_STORE = 'diffMaps';
const MAX_FILES = 20;
const MAX_SIZE_MB = 50;

class MapFileDB {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const oldVersion = event.oldVersion;

        // Create or update mapFiles store
        if (!db.objectStoreNames.contains(MAP_FILES_STORE)) {
          const mapStore = db.createObjectStore(MAP_FILES_STORE, { keyPath: 'sessionId' });
          mapStore.createIndex('timestamp', 'temporal.createdAt', { unique: false });
          mapStore.createIndex('displayName', 'displayName', { unique: false });
          mapStore.createIndex('country', 'location.country', { unique: false });
          mapStore.createIndex('state', 'location.state', { unique: false });
          mapStore.createIndex('city', 'location.city', { unique: false });
          mapStore.createIndex('captureStart', 'temporal.captureStart', { unique: false });
          mapStore.createIndex('captureEnd', 'temporal.captureEnd', { unique: false });
          mapStore.createIndex('status', 'temporal.status', { unique: false });
          mapStore.createIndex('coverageType', 'coverage.type', { unique: false });
        } else if (oldVersion < 2) {
          // Migration: add new indexes to existing store
          const tx = (event.target as IDBOpenDBRequest).transaction!;
          const mapStore = tx.objectStore(MAP_FILES_STORE);
          
          if (!mapStore.indexNames.contains('displayName')) {
            mapStore.createIndex('displayName', 'displayName', { unique: false });
          }
          if (!mapStore.indexNames.contains('country')) {
            mapStore.createIndex('country', 'location.country', { unique: false });
          }
          if (!mapStore.indexNames.contains('state')) {
            mapStore.createIndex('state', 'location.state', { unique: false });
          }
          if (!mapStore.indexNames.contains('city')) {
            mapStore.createIndex('city', 'location.city', { unique: false });
          }
          if (!mapStore.indexNames.contains('captureStart')) {
            mapStore.createIndex('captureStart', 'temporal.captureStart', { unique: false });
          }
          if (!mapStore.indexNames.contains('captureEnd')) {
            mapStore.createIndex('captureEnd', 'temporal.captureEnd', { unique: false });
          }
          if (!mapStore.indexNames.contains('status')) {
            mapStore.createIndex('status', 'temporal.status', { unique: false });
          }
          if (!mapStore.indexNames.contains('coverageType')) {
            mapStore.createIndex('coverageType', 'coverage.type', { unique: false });
          }
        }

        // Create or update branches store
        if (!db.objectStoreNames.contains(BRANCHES_STORE)) {
          const branchStore = db.createObjectStore(BRANCHES_STORE, { keyPath: 'branchId' });
          branchStore.createIndex('parentMapId', 'parentMapId', { unique: false });
          branchStore.createIndex('timestamp', 'temporal.createdAt', { unique: false });
        }

        // Create diffMaps store
        if (!db.objectStoreNames.contains(DIFF_MAPS_STORE)) {
          const diffStore = db.createObjectStore(DIFF_MAPS_STORE, { keyPath: 'diffId' });
          diffStore.createIndex('createdAt', 'createdAt', { unique: false });
          diffStore.createIndex('sessionAId', 'sessionA.sessionId', { unique: false });
          diffStore.createIndex('sessionBId', 'sessionB.sessionId', { unique: false });
        }
      };
    });
  }

  async saveDiffMap(diffMap: any): Promise<string> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(DIFF_MAPS_STORE, 'readwrite');
      const store = tx.objectStore(DIFF_MAPS_STORE);
      store.put(diffMap);
      
      tx.oncomplete = () => resolve(diffMap.diffId);
      tx.onerror = () => reject(tx.error);
    });
  }

  async loadDiffMap(diffId: string): Promise<any | null> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(DIFF_MAPS_STORE, 'readonly');
      const store = tx.objectStore(DIFF_MAPS_STORE);
      const request = store.get(diffId);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async listDiffMaps(): Promise<any[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(DIFF_MAPS_STORE, 'readonly');
      const store = tx.objectStore(DIFF_MAPS_STORE);
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteDiffMap(diffId: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(DIFF_MAPS_STORE, 'readwrite');
      const store = tx.objectStore(DIFF_MAPS_STORE);
      store.delete(diffId);
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async saveMapFile(file: MapFile): Promise<string> {
    await this.init();
    await this.enforceQuota();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(MAP_FILES_STORE, 'readwrite');
      const store = tx.objectStore(MAP_FILES_STORE);
      store.put(file);
      
      tx.oncomplete = () => resolve(file.sessionId);
      tx.onerror = () => reject(tx.error);
    });
  }

  async loadMapFile(sessionId: string): Promise<MapFile | null> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(MAP_FILES_STORE, 'readonly');
      const request = tx.objectStore(MAP_FILES_STORE).get(sessionId);
      
      request.onsuccess = () => {
        const file = request.result;
        if (!file) {
          resolve(null);
          return;
        }

        // Auto-migrate legacy files
        if (isLegacyMapFile(file)) {
          const migrated = migrateLegacyMapFile(file) as MapFile;
          // Save migrated version
          this.saveMapFile(migrated).catch(console.error);
          resolve(migrated);
        } else {
          resolve(file);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async listMapFiles(): Promise<MapFile[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(MAP_FILES_STORE, 'readonly');
      const request = tx.objectStore(MAP_FILES_STORE).getAll();
      
      request.onsuccess = () => {
        const files = request.result.map((file: any) => {
          // Auto-migrate legacy files
          if (isLegacyMapFile(file)) {
            const migrated = migrateLegacyMapFile(file) as MapFile;
            this.saveMapFile(migrated).catch(console.error);
            return migrated;
          }
          return file;
        });
        resolve(files);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async listMapFilesByCity(city: string): Promise<MapFile[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(MAP_FILES_STORE, 'readonly');
      const index = tx.objectStore(MAP_FILES_STORE).index('city');
      const request = index.getAll(city);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async listMapFilesByState(state: string): Promise<MapFile[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(MAP_FILES_STORE, 'readonly');
      const index = tx.objectStore(MAP_FILES_STORE).index('state');
      const request = index.getAll(state);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async listMapFilesByCountry(country: string): Promise<MapFile[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(MAP_FILES_STORE, 'readonly');
      const index = tx.objectStore(MAP_FILES_STORE).index('country');
      const request = index.getAll(country);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveBranch(branch: ScenarioBranch): Promise<string> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(BRANCHES_STORE, 'readwrite');
      const store = tx.objectStore(BRANCHES_STORE);
      store.put(branch);
      
      tx.oncomplete = () => resolve(branch.branchId);
      tx.onerror = () => reject(tx.error);
    });
  }

  async loadBranch(branchId: string): Promise<ScenarioBranch | null> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(BRANCHES_STORE, 'readonly');
      const request = tx.objectStore(BRANCHES_STORE).get(branchId);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async listBranches(parentMapId?: string): Promise<ScenarioBranch[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(BRANCHES_STORE, 'readonly');
      const store = tx.objectStore(BRANCHES_STORE);

      if (parentMapId) {
        const index = store.index('parentMapId');
        const request = index.getAll(parentMapId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      } else {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }
    });
  }

  async deleteMapFile(sessionId: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(MAP_FILES_STORE, 'readwrite');
      const store = tx.objectStore(MAP_FILES_STORE);
      store.delete(sessionId);
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async deleteBranch(branchId: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(BRANCHES_STORE, 'readwrite');
      const store = tx.objectStore(BRANCHES_STORE);
      store.delete(branchId);
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  private async enforceQuota(): Promise<void> {
    const files = await this.listMapFiles();
    
    if (files.length >= MAX_FILES) {
      // LRU eviction: remove oldest file by creation time
      files.sort((a, b) => a.temporal.createdAt - b.temporal.createdAt);
      await this.deleteMapFile(files[0].sessionId);
      console.log(`[MapFileDB] Evicted oldest file: ${files[0].displayName}`);
    }

    // Check storage quota
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      const usageMB = (estimate.usage || 0) / (1024 * 1024);
      
      if (usageMB > MAX_SIZE_MB) {
        // Evict oldest files until under quota
        const sortedFiles = files.sort((a, b) => a.temporal.createdAt - b.temporal.createdAt);
        for (const file of sortedFiles) {
          await this.deleteMapFile(file.sessionId);
          const newEstimate = await navigator.storage.estimate();
          const newUsageMB = (newEstimate.usage || 0) / (1024 * 1024);
          if (newUsageMB <= MAX_SIZE_MB) break;
        }
      }
    }
  }
}

export const mapFileDB = new MapFileDB();
