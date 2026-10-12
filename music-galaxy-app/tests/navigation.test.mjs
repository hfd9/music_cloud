import test from 'node:test';
import assert from 'node:assert/strict';
import { GalaxyEngine } from '../prototype/src/galaxy.js';
import { artists } from '../prototype/src/catalog.js';

function cameraAt(artist, distance) {
  const engine = Object.create(GalaxyEngine.prototype);
  Object.assign(engine, { target: [...artist.position], distance, yaw: .15, pitch: .42, width: 1400, height: 800, focal: 880, filter: { genreId: artist.genreId, region: '' }, expanded: null });
  engine.basis(); return engine;
}
test('camera proximity reveals tracks without a search or artist selection, with exit hysteresis', () => {
  const engine = cameraAt(artists[0], 640);
  engine.updateExpansion(); assert.equal(engine.expanded.id, artists[0].id);
  engine.distance = 950; engine.basis(); engine.updateExpansion(); assert.equal(engine.expanded.id, artists[0].id);
  engine.distance = 2200; engine.basis(); engine.updateExpansion(); assert.equal(engine.expanded, null);
});
test('zoom at cursor retains world point screen position and camera limits', () => {
  const engine = cameraAt(artists[0], 2000), point = [engine.target[0] + 150, engine.target[1] + 100, engine.target[2]];
  // A point on the target plane should remain directly below the cursor when zooming.
  const planePoint = engine.target.map((v, i) => v + engine.right[i] * 150 + engine.up[i] * 100);
  const before = engine.project(planePoint); engine.zoom(.7, before.x, before.y); engine.basis();
  const after = engine.project(planePoint); assert.ok(Math.abs(after.x - before.x) < 1e-8); assert.ok(Math.abs(after.y - before.y) < 1e-8);
  engine.zoom(.00001); assert.equal(engine.distance, 100); engine.zoom(1e9); assert.equal(engine.distance, 11000);
  assert.ok(engine.project(point));
});
test('filter mismatch collapses expanded artist and camera navigation keeps selected song', () => {
  const engine = cameraAt(artists[0], 640); engine.selected = { type: 'track', id: 'track_0001' };
  engine.updateExpansion(); engine.setFilters({ genreId: 'not-a-genre', region: '' }); engine.updateExpansion();
  assert.equal(engine.expanded, null); engine.pan(100, 60); engine.zoom(.9);
  assert.deepEqual(engine.selected, { type: 'track', id: 'track_0001' });
});
