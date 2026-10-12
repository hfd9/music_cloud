import test from 'node:test';
import assert from 'node:assert/strict';
import { DemoPlayer } from '../prototype/src/player.js';
import { tracks } from '../prototype/src/catalog.js';

class FakeAudioContext {
  currentTime = 0; state = 'running';
  resume() { return this.resumeResult || Promise.resolve(); }
  addEventListener() {}
  createGain() { return { gain: { value: 0, setTargetAtTime() {}, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
  createAnalyser() { return { frequencyBinCount: 128, connect() {}, getByteFrequencyData(buffer) { buffer.fill(20); } }; }
  createOscillator() { return { frequency: { value: 0 }, connect() {}, disconnect() {}, start() {}, stop() {} }; }
  close() { this.state = 'closed'; return Promise.resolve(); }
}
globalThis.window = { AudioContext: FakeAudioContext };

test('pause preserves playback position and releases scheduled voices; resuming does not duplicate sessions', async () => {
  const player = new DemoPlayer(() => {});
  try {
    player.select(tracks[0]); await player.play(); assert.equal(player.status, 'playing'); assert.ok(player.voices.size > 0);
    player.context.currentTime = 12; player.pause(); assert.equal(player.snapshot().elapsed, 12); assert.equal(player.voices.size, 0); assert.equal(player.timer, null);
    await Promise.all([player.play(), player.play()]); assert.equal(player.status, 'playing'); assert.equal(player.snapshot().elapsed, 12);
    player.context.currentTime = player.startedAt + 46; player.tick(); assert.equal(player.status, 'ended'); assert.equal(player.voices.size, 0); assert.equal(player.timer, null);
  } finally { player.dispose(); }
});
test('late audio resume cannot start a track after selection has changed', async () => {
  const player = new DemoPlayer(() => {}); let resume;
  try {
    player.select(tracks[0]); player.ensureContext(); player.context.resumeResult = new Promise(resolve => { resume = resolve; });
    const pending = player.play(); player.select(tracks[1]); resume(); await pending;
    assert.equal(player.snapshot().trackId, tracks[1].id); assert.equal(player.status, 'paused'); assert.equal(player.voices.size, 0);
  } finally { player.dispose(); }
});
