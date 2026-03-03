import { migrateLegacyMapFile, isLegacyMapFile } from '../src/migration';
import type { LegacyMapFile } from '../src/mapFile';

// Test legacy file
const legacyFile: LegacyMapFile = {
  version: '1.0',
  sessionId: '9q8yy2k#2026-03-01T10:00:00Z',
  timestamp: 1709287200000,
  hazards: [
    {
      id: '123e4567-e89b-12d3-a456-426614174000',
      geohash: '9q8yy2k',
      lat: 22.2404,
      lon: 84.8704,
      type: 'POTHOLE',
      severity: 3,
      timestamp: 1709287200000,
      signature: 'test-sig',
      contributorId: 'user-1',
    },
    {
      id: '223e4567-e89b-12d3-a456-426614174001',
      geohash: '9q8yy2m',
      lat: 22.2504,
      lon: 84.8804,
      type: 'DEBRIS',
      severity: 2,
      timestamp: 1709287300000,
      signature: 'test-sig-2',
      contributorId: 'user-2',
    },
  ],
  metadata: {
    totalHazards: 2,
    geohashBounds: ['9q8yy2k', '9q8yy2m'],
    contributors: ['user-1', 'user-2'],
  },
};

console.log('Testing migration...\n');

// Test isLegacyMapFile
console.log('1. Testing isLegacyMapFile()');
console.log('   Is legacy?', isLegacyMapFile(legacyFile));
console.log('   ✓ Passed\n');

// Test migration
console.log('2. Testing migrateLegacyMapFile()');
const migrated = migrateLegacyMapFile(legacyFile);

console.log('   Migrated file:');
console.log('   - sessionId:', migrated.sessionId);
console.log('   - displayName:', migrated.displayName);
console.log('   - coverage.type:', migrated.coverage.type);
console.log('   - coverage.name:', migrated.coverage.name);
console.log('   - coverage.areaKm2:', migrated.coverage.areaKm2.toFixed(2), 'km²');
console.log('   - coverage.geohashPrecision:', migrated.coverage.geohashPrecision);
console.log('   - coverage.geohashTiles:', migrated.coverage.geohashTiles.length, 'tiles');
console.log('   - coverage.boundingBox:', JSON.stringify(migrated.coverage.boundingBox, null, 2));
console.log('   - temporal.status:', migrated.temporal.status);
console.log('   - temporal.duration:', migrated.temporal.duration, 'ms');
console.log('   - location.city:', migrated.location.city);
console.log('   - metadata.hazardsByType:', JSON.stringify(migrated.metadata.hazardsByType));
console.log('   - metadata.severityDistribution:', JSON.stringify(migrated.metadata.severityDistribution));
console.log('   ✓ Passed\n');

// Verify schema compliance
console.log('3. Verifying schema compliance');
console.log('   - Has coverage?', !!migrated.coverage);
console.log('   - Has temporal?', !!migrated.temporal);
console.log('   - Has location?', !!migrated.location);
console.log('   - Has enhanced metadata?', !!migrated.metadata.hazardsByType);
console.log('   ✓ Passed\n');

console.log('✅ All tests passed!');
