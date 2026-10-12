import test from 'node:test';
import assert from 'node:assert/strict';
import { artists, tracks, genres, trackPosition, listenerAmplitude, randomGenerator } from '../prototype/src/catalog.js';

test('demo catalogue has complete unique entity references and finite stable positions', () => {
  assert.equal(artists.length, 200); assert.equal(tracks.length, 1000);
  const ids = new Set([...artists, ...tracks].map(entity => entity.id)); assert.equal(ids.size, 1200);
  for (const artist of artists) {
    assert.ok(genres.some(g => g.id === artist.genreId)); assert.ok(artist.position.every(Number.isFinite));
    assert.equal(tracks.filter(t => t.artistId === artist.id).length, 5);
    assert.equal(artist.metrics.source, 'demo');
  }
  for (const track of tracks) { assert.ok(ids.has(track.artistId)); assert.equal(track.capabilities.canAggregateListeners, false); }
  const a = randomGenerator(42), b = randomGenerator(42); assert.deepEqual(Array.from({ length: 10 }, a), Array.from({ length: 10 }, b));
  for (let i = 0; i < 5; i++) assert.ok(trackPosition(artists[0], i).every(Number.isFinite));
});
test('listener pulse stops at known zero and unknown, increases and remains capped', () => {
  assert.equal(listenerAmplitude(0), 0); assert.equal(listenerAmplitude(null), 0);
  assert.ok(listenerAmplitude(1) < listenerAmplitude(10)); assert.ok(listenerAmplitude(10) < listenerAmplitude(65));
  assert.equal(listenerAmplitude(1e12), .12);
});
