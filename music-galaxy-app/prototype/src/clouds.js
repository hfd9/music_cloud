import { randomGenerator } from './catalog.js';

function seedFromId(id) {
  let seed = 2166136261;
  for (let i = 0; i < id.length; i++) seed = Math.imul(seed ^ id.charCodeAt(i), 16777619);
  return seed >>> 0;
}
// A fixed world-space kernel makes quantities comparable between regions.
// Do not normalize every region by its own maximum: that makes sparse and dense regions identical.
export function cloudDensity(position, members, bandwidth = 190) {
  let density = 0;
  for (const member of members) {
    const squaredDistance = member.position.reduce((sum, value, axis) => sum + (value - position[axis]) ** 2, 0);
    density += Math.exp(-squaredDistance / (2 * bandwidth ** 2));
  }
  return density;
}
export function buildCloudModel(genre, members) {
  const ordered = [...members].sort((a, b) => a.id.localeCompare(b.id));
  const count = ordered.length;
  const brightness = 1 - Math.exp(-count / 32);
  const concentration = 1 - Math.exp(-count / 24);
  if (!count) return { count: 0, brightness: 0, concentration: 0, puffs: [], dust: [] };
  const puffs = [], dust = [];
  for (const member of ordered) {
    const random = randomGenerator(seedFromId(`${genre.id}:${member.id}`));
    for (let i = 0; i < 2; i++) {
      const position = member.position.map(v => v + (random() - .5) * 145);
      const density = cloudDensity(position, ordered);
      const localConcentration = 1 - Math.exp(-density / 7);
      puffs.push({ position, radius: 190 + random() * 160, aspect: .65 + random() * .7, rotation: random() * Math.PI, variant: Math.floor(random() * 4),
        alpha: (.1 + brightness * .1) * localConcentration, density });
    }
    for (let i = 0; i < 10; i++) {
      const position = member.position.map(v => v + (random() + random() - 1) * 140);
      dust.push({ position, size: .3 + random() * 1.2, alpha: (.14 + random() * .5) * (.25 + concentration * .75) });
    }
  }
  return { count, brightness, concentration, puffs, dust };
}

function hashNoise(x, y, seed) {
  let hash = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ seed;
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967295;
}
function noise(x, y, seed) {
  const ix = Math.floor(x), iy = Math.floor(y);
  let fx = x - ix, fy = y - iy; fx *= fx * (3 - 2 * fx); fy *= fy * (3 - 2 * fy);
  const a = hashNoise(ix, iy, seed), b = hashNoise(ix + 1, iy, seed), c = hashNoise(ix, iy + 1, seed), d = hashNoise(ix + 1, iy + 1, seed);
  return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
}
export function cloudTexturePixels(color, variant, size = 128) {
  const pixels = new Uint8ClampedArray(size * size * 4);
  const rgb = [1, 3, 5].map(start => parseInt(color.slice(start, start + 2), 16));
  const seed = seedFromId(`${color}:${variant}`);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const nx = x / size * 2 - 1, ny = y / size * 2 - 1;
    const warp = noise(nx * 2.5 + 4, ny * 2.5 + 4, seed);
    const radius = Math.hypot(nx + (warp - .5) * .4, ny + (noise(nx * 3 + 11, ny * 3 + 11, seed) - .5) * .4);
    const envelope = Math.max(0, 1 - radius ** 2) ** 1.4;
    const broad = noise(nx * 2.8 + 8, ny * 2.8 + 8, seed);
    const detail = noise(nx * 9 + warp * 2 + 21, ny * 9 + warp * 2 + 21, seed);
    const grain = noise(nx * 22 + 40, ny * 22 + 40, seed);
    const density = Math.max(0, broad * .65 + detail * .27 + grain * .08 - .24);
    const offset = (y * size + x) * 4;
    pixels[offset] = rgb[0]; pixels[offset + 1] = rgb[1]; pixels[offset + 2] = rgb[2];
    pixels[offset + 3] = Math.min(210, envelope * density * 450);
  }
  return pixels;
}
