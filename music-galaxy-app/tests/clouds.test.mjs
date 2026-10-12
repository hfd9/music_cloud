import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCloudModel, cloudDensity, cloudTexturePixels } from '../prototype/src/clouds.js';
import { artists, genres } from '../prototype/src/catalog.js';

const genre = { id: 'test', color: '#91b9ed' };
const members = count => Array.from({ length: count }, (_, i) => ({ id: `artist_${i}`, position: [i % 3 * 10, 0, i % 2 * 10] }));
test('cloud brightness and concentration respond to entity count and empty regions have no decoration', () => {
  const empty = buildCloudModel(genre, []), sparse = buildCloudModel(genre, members(9)), dense = buildCloudModel(genre, members(49));
  assert.equal(empty.brightness, 0); assert.equal(empty.puffs.length, 0); assert.equal(empty.dust.length, 0);
  assert.ok(dense.brightness > sparse.brightness); assert.ok(dense.concentration > sparse.concentration);
  assert.ok(dense.puffs[0].alpha > sparse.puffs[0].alpha); assert.ok(dense.dust.length > sparse.dust.length);
  for (const puff of dense.puffs) { assert.ok(puff.position.every(Number.isFinite)); assert.ok(puff.alpha >= 0 && puff.alpha <= 1); }
});
test('local node clustering makes density higher than the same number of dispersed nodes', () => {
  const compact = members(20), dispersed = compact.map((a, i) => ({ ...a, position: [i * 600, 0, 0] }));
  assert.ok(cloudDensity([0, 0, 0], compact) > cloudDensity([0, 0, 0], dispersed) * 5);
});
test('cloud morphology is deterministic and independent of incoming catalogue order', () => {
  const input = members(12);
  assert.deepEqual(buildCloudModel(genre, input), buildCloudModel(genre, [...input].reverse()));
  assert.notDeepEqual(buildCloudModel(genre, input).puffs, buildCloudModel({ ...genre, id: 'other' }, input).puffs);
  const pixels = cloudTexturePixels(genre.color, 0, 32);
  assert.deepEqual(pixels, cloudTexturePixels(genre.color, 0, 32));
  assert.notDeepEqual(pixels, cloudTexturePixels(genre.color, 1, 32));
  assert.equal(pixels[3], 0); assert.ok(pixels.some((value, i) => i % 4 === 3 && value > 0));
});
test('demo has distinct region populations without changing total catalogue size', () => {
  const counts = genres.map(g => artists.filter(a => a.genreId === g.id).length);
  assert.equal(counts.reduce((sum, n) => sum + n, 0), 200); assert.equal(new Set(counts).size, 8);
});
