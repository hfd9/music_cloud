/** All entities are fictional; no third-party catalogue, recording or popularity data. */
export const SEED = 20261012;
export const VERSION = 'fictional-demo-v2';
export function randomGenerator(seed) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}
export const genres = [
  ['ambient', '氛围', '#91b9ed', '在缓慢的声音里，漂浮一会儿'],
  ['electronic', '电子', '#aaa0ff', '合成器、脉冲与深空回声'],
  ['jazz', '爵士', '#f6c88e', '自由的节奏，不期而遇的旋律'],
  ['indie', '独立', '#e5a2c4', '那些藏在日常缝隙里的声音'],
  ['folk', '民谣', '#e5d9ad', '一把琴，一段缓缓展开的故事'],
  ['classical', '古典', '#a9cddb', '听见时间，也听见空间'],
  ['soul', '灵魂', '#dd9c87', '温暖的和声与有呼吸的律动'],
  ['rock', '摇滚', '#b1d3a2', '让吉他划过寂静的夜空']
].map(([id, name, color, description], i) => {
  const angle = i / 8 * Math.PI * 2;
  return { id, name, color, description, position: [Math.cos(angle) * 1550, Math.sin(i * 2) * 200, Math.sin(angle) * 1250] };
});
const prefixes = ['雾岛', '长夜', '失重', '青蓝', '雨后', '低频', '白昼', '微光', '远山', '流动', '月面', '无声', '暮色', '极地', '海岸', '夏末', '北方', '漫游', '银色', '晚风', '深空', '清晨', '暗潮', '玻璃', '回声'];
const suffixes = ['电台', '航线', '房间', '花园', '来信', '旅人', '计划', '档案'];
const titles = ['漂浮之间', '经过你的夜晚', '第七次日落', '没有终点的路', '留给明天的光'];
const random = randomGenerator(SEED);
// Deliberately uneven populations so the prototype demonstrates count-driven clouds.
const genrePopulations = [12, 42, 18, 31, 15, 9, 24, 49];
let artistIndex = 0;
export const artists = genres.flatMap((genre, g) => {
  const shapeRandom = randomGenerator(SEED + g * 87);
  const lobes = Array.from({ length: 2 + g % 3 }, () => [(shapeRandom() - .5) * 570, (shapeRandom() - .5) * 300, (shapeRandom() - .5) * 530]);
  return Array.from({ length: genrePopulations[g] }, (_, i) => {
  const lobe = lobes[i % lobes.length];
  const spread = 100 + shapeRandom() * 90;
  const offset = () => (shapeRandom() + shapeRandom() + shapeRandom() - 1.5) * spread;
  const id = `artist_${String(++artistIndex).padStart(3, '0')}`;
  return {
    id, name: `${prefixes[i % prefixes.length]}${suffixes[g]}${i >= prefixes.length ? ` ${Math.floor(i / prefixes.length) + 1}` : ''}`, genreId: genre.id, color: genre.color,
    region: ['CN', 'JP', 'US', 'GB', 'FR'][i % 5],
    description: `${genre.description}。这是用于验证探索体验的虚构歌手，歌曲与指标均为演示。`,
    position: genre.position.map((v, axis) => v + lobe[axis] + offset()),
    metrics: { longTermScore: random(), recentScore: random(), activeListeners: i % 11 === 0 ? null : i % 7 === 0 ? 0 : Math.floor(random() * 65), source: 'demo' }
  };
  });
});
export const tracks = artists.flatMap((artist, a) => titles.map((title, i) => ({
  id: `track_${String(a * 5 + i + 1).padStart(4, '0')}`, artistId: artist.id,
  title: `${title}${i === 0 ? '' : ` · ${a % 9 + 1}`}`, duration: 45, seed: a * 5 + i,
  source: 'procedural-demo', capabilities: { canPlayHere: true, canAnalyzeAudio: true, canAggregateListeners: false },
  metrics: { longTermScore: random(), recentScore: random(), activeListeners: i === 4 ? null : i === 3 ? 0 : Math.floor(random() * 24), source: 'demo' }
})));
export const artistById = new Map(artists.map(a => [a.id, a]));
export const trackById = new Map(tracks.map(t => [t.id, t]));
export const tracksByArtist = new Map(artists.map(a => [a.id, tracks.filter(t => t.artistId === a.id)]));
export function normalize(value, q95 = 65) { return Math.max(0, Math.min(1, Math.log1p(Math.max(0, value)) / Math.log1p(Math.max(1, q95)))); }
export function listenerAmplitude(value) { return value === null ? 0 : .12 * normalize(value); }
export function trackPosition(artist, index) {
  const angle = index / 5 * Math.PI * 2 + .35;
  const radius = 155 + index * 18;
  return [artist.position[0] + Math.cos(angle) * radius, artist.position[1] + Math.sin(angle) * radius * .75, artist.position[2] + Math.sin(angle) * 45];
}
