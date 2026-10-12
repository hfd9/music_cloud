import { artists, genres, artistById, tracksByArtist, trackPosition, randomGenerator, listenerAmplitude } from './catalog.js';
import { buildCloudModel, cloudTexturePixels } from './clouds.js';

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => a.map((v, i) => v - b[i]);
const length = a => Math.hypot(...a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export class GalaxyEngine {
  constructor(canvas, { onSelect, onHover, onLevel, onStats }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    if (!this.ctx) throw new Error('此浏览器不支持 Canvas，请使用歌手列表探索。');
    Object.assign(this, { onSelect, onHover, onLevel, onStats });
    this.target = [0, 0, 0]; this.distance = 5700; this.yaw = .15; this.pitch = .42;
    this.quality = 'medium'; this.reducedMotion = false; this.selected = null;
    this.filter = { genreId: '', region: '' }; this.expanded = null; this.energy = 0;
    this.hitNodes = []; this.pointers = new Map(); this.listeners = []; this.lastTime = 0; this.frames = [];
    const random = randomGenerator(4142);
    this.stars = Array.from({ length: 2200 }, () => ({ x: random(), y: random(), size: random(), phase: random() * Math.PI * 2 }));
    this.haloTextures = new Map(); this.cloudTextures = new Map();
    this.cloudModels = genres.map(genre => buildCloudModel(genre, artists.filter(a => a.genreId === genre.id)));
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(canvas);
    this.listen(canvas, 'pointerdown', e => this.pointerDown(e));
    this.listen(canvas, 'pointermove', e => this.pointerMove(e));
    this.listen(canvas, 'pointerup', e => this.pointerUp(e));
    this.listen(canvas, 'pointercancel', () => { this.pointers.clear(); this.down = null; });
    this.listen(canvas, 'pointerleave', () => { if (!this.pointers.size) this.onHover(null); });
    this.listen(canvas, 'wheel', e => { e.preventDefault(); this.zoom(Math.exp(clamp(e.deltaY, -180, 180) * .002), e.clientX, e.clientY); }, { passive: false });
    this.listen(canvas, 'contextmenu', e => e.preventDefault());
    this.listen(canvas, 'keydown', e => this.keydown(e));
    this.listen(document, 'visibilitychange', () => {
      cancelAnimationFrame(this.raf); this.lastTime = 0;
      if (!document.hidden) this.raf = requestAnimationFrame(t => this.frame(t));
    });
    this.resize(); this.raf = requestAnimationFrame(t => this.frame(t));
  }
  listen(target, type, fn, opts) { target.addEventListener(type, fn, opts); this.listeners.push(() => target.removeEventListener(type, fn, opts)); }
  resize() {
    const rect = this.canvas.getBoundingClientRect(); this.width = rect.width; this.height = rect.height;
    this.dpr = Math.min(devicePixelRatio || 1, { low: 1, medium: 1.25, high: 1.5 }[this.quality]);
    this.canvas.width = Math.round(this.width * this.dpr); this.canvas.height = Math.round(this.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); this.focal = Math.min(this.width, this.height) * 1.1;
  }
  basis() {
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw), sp = Math.sin(this.pitch), cp = Math.cos(this.pitch);
    this.right = [cy, 0, -sy]; this.up = [-sy * sp, cp, -cy * sp]; this.forward = [-sy * cp, -sp, -cy * cp];
    this.camera = this.target.map((v, i) => v - this.forward[i] * this.distance);
  }
  project(position) {
    const delta = sub(position, this.camera), depth = dot(delta, this.forward);
    if (depth < 20) return null;
    return { x: this.width / 2 + dot(delta, this.right) * this.focal / depth, y: this.height / 2 - dot(delta, this.up) * this.focal / depth, depth, scale: this.focal / depth };
  }
  matches(artist) { return (!this.filter.genreId || this.filter.genreId === artist.genreId) && (!this.filter.region || this.filter.region === artist.region); }
  setFilters(filter) { this.filter = filter; }
  setSelected(entity) { this.selected = entity; }
  setQuality(tier) { this.quality = tier; this.resize(); }
  setReducedMotion(value) { this.reducedMotion = value; if (value && this.flight) { this.target = this.flight.target; this.distance = this.flight.distance; this.flight = null; } }
  focusArtist(id) { const artist = artistById.get(id); if (artist) { this.expanded = null; this.fly(artist.position, 640); } }
  fly(target, distance) {
    this.onHover(null);
    if (this.reducedMotion) { this.target = [...target]; this.distance = distance; this.flight = null; return; }
    this.flight = { fromTarget: [...this.target], fromDistance: this.distance, target: [...target], distance, start: performance.now() };
  }
  home() { this.fly([0, 0, 0], 5700); }
  zoom(factor, x = this.width / 2, y = this.height / 2) {
    this.flight = null; this.basis();
    const next = clamp(this.distance * factor, 100, 11000), diff = this.distance - next;
    const sx = (x - this.width / 2) / this.focal, sy = -(y - this.height / 2) / this.focal;
    this.target = this.target.map((v, i) => clamp(v + (this.right[i] * sx + this.up[i] * sy) * diff, -5000, 5000));
    this.distance = next;
  }
  pan(dx, dy) {
    this.basis(); const amount = this.distance / this.focal;
    this.target = this.target.map((v, i) => clamp(v - this.right[i] * dx * amount + this.up[i] * dy * amount, -5000, 5000));
  }
  pointerDown(e) {
    this.flight = null; this.canvas.focus({ preventScroll: true }); this.canvas.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.down = { x: e.clientX, y: e.clientY, multi: this.pointers.size > 1, dragged: false };
    this.onHover(null);
  }
  pointerMove(e) {
    const old = this.pointers.get(e.pointerId);
    if (!old) { const hit = this.hitTest(e.clientX, e.clientY); this.canvas.style.cursor = hit ? 'pointer' : 'grab'; this.onHover(hit, e.clientX, e.clientY); return; }
    this.flight = null;
    if (this.pointers.size === 2) {
      const other = [...this.pointers.entries()].find(([id]) => id !== e.pointerId)[1];
      const previous = Math.hypot(old.x - other.x, old.y - other.y);
      const current = Math.hypot(e.clientX - other.x, e.clientY - other.y);
      if (current > 5) this.zoom(previous / current, (e.clientX + other.x) / 2, (e.clientY + other.y) / 2);
      this.pan((e.clientX - old.x) / 2, (e.clientY - old.y) / 2); this.down.multi = true;
    } else if (e.shiftKey || e.buttons === 2) {
      this.yaw -= (e.clientX - old.x) * .004; this.pitch = clamp(this.pitch + (e.clientY - old.y) * .004, -1.15, 1.15);
    } else this.pan(e.clientX - old.x, e.clientY - old.y);
    if (this.down && Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 6) this.down.dragged = true;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }
  pointerUp(e) {
    if (this.down && !this.down.multi && !this.down.dragged && e.button === 0) {
      const hit = this.hitTest(e.clientX, e.clientY); if (hit) this.onSelect({ type: hit.type, id: hit.id });
    }
    this.pointers.delete(e.pointerId); if (!this.pointers.size) this.down = null;
  }
  keydown(e) {
    const actions = { ArrowLeft: () => this.pan(70, 0), ArrowRight: () => this.pan(-70, 0), ArrowUp: () => this.pan(0, 70), ArrowDown: () => this.pan(0, -70), '+': () => this.zoom(.8), '=': () => this.zoom(.8), '-': () => this.zoom(1.25), Home: () => this.home() };
    if (actions[e.key]) { e.preventDefault(); this.flight = null; actions[e.key](); }
  }
  hitTest(x, y) {
    return this.hitNodes.filter(n => Math.hypot(n.x - x, n.y - y) < n.hitRadius).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0] || null;
  }
  updateExpansion() {
    if (this.expanded) {
      const p = this.project(this.expanded.position);
      if (length(sub(this.expanded.position, this.camera)) < 1100 && p && p.x > -150 && p.x < this.width + 150 && p.y > -150 && p.y < this.height + 150 && this.matches(this.expanded)) return;
      this.expanded = null;
    }
    const candidates = artists.filter(a => this.matches(a)).map(a => ({ a, distance: length(sub(a.position, this.camera)), p: this.project(a.position) })).filter(c => c.distance < 850 && c.p && c.p.x > 30 && c.p.x < this.width - 30 && c.p.y > 60 && c.p.y < this.height - 90);
    candidates.sort((a, b) => Math.hypot(a.p.x - this.width / 2, a.p.y - this.height / 2) - Math.hypot(b.p.x - this.width / 2, b.p.y - this.height / 2));
    this.expanded = candidates[0]?.a || null;
  }
  glow(x, y, radius, color, alpha = 1) {
    const ctx = this.ctx; ctx.globalAlpha = alpha;
    ctx.drawImage(this.haloTexture(color), x - radius, y - radius, radius * 2, radius * 2); ctx.globalAlpha = 1;
  }
  haloTexture(color) {
    if (this.haloTextures.has(color)) return this.haloTextures.get(color);
    const texture = document.createElement('canvas'); texture.width = texture.height = 128;
    const ctx = texture.getContext('2d'), gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, color + 'df'); gradient.addColorStop(.08, color + '95'); gradient.addColorStop(.23, color + '25'); gradient.addColorStop(.6, color + '08'); gradient.addColorStop(1, color + '00');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128); this.haloTextures.set(color, texture); return texture;
  }
  cloudTexture(color, variant) {
    const key = `${color}:${variant}`;
    if (this.cloudTextures.has(key)) return this.cloudTextures.get(key);
    const texture = document.createElement('canvas'); texture.width = texture.height = 128;
    const ctx = texture.getContext('2d'), data = ctx.createImageData(128, 128);
    data.data.set(cloudTexturePixels(color, variant)); ctx.putImageData(data, 0, 0);
    this.cloudTextures.set(key, texture); return texture;
  }
  nebula(genre, index, alpha) {
    const projected = this.cloudModels[index].puffs.map(puff => ({ puff, point: this.project(puff.position) })).filter(p => p.point).sort((a, b) => b.point.depth - a.point.depth);
    const ctx = this.ctx;
    for (const { puff, point } of projected) {
      const radius = Math.min(650, puff.radius * point.scale);
      if (point.x + radius < 0 || point.x - radius > this.width || point.y + radius < 0 || point.y - radius > this.height) continue;
      ctx.save(); ctx.translate(point.x, point.y); ctx.rotate(puff.rotation + this.yaw * .12);
      ctx.globalAlpha = puff.alpha * alpha;
      ctx.drawImage(this.cloudTexture(genre.color, puff.variant), -radius, -radius * puff.aspect, radius * 2, radius * 2 * puff.aspect); ctx.restore();
    }
  }
  planet(node, radius, time) {
    const ctx = this.ctx, { x, y, color } = node;
    const body = ctx.createRadialGradient(x - radius * .43, y - radius * .43, radius * .03, x + radius * .1, y + radius * .1, radius * 1.25);
    body.addColorStop(0, '#fbf2e7'); body.addColorStop(.22, color); body.addColorStop(.55, color); body.addColorStop(.82, '#242137'); body.addColorStop(1, '#0a0c17');
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.clip(); ctx.fillStyle = body; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    const phase = this.reducedMotion ? 0 : time * .02;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath(); ctx.ellipse(x - radius * .2, y + (i - 1.5) * radius * .35, radius * 1.3, radius * .13, -.35 + phase, 0, Math.PI * 2);
      ctx.strokeStyle = i % 2 ? '#ffffff15' : '#080b1620'; ctx.lineWidth = radius * .1; ctx.stroke();
    }
    ctx.restore(); ctx.beginPath(); ctx.arc(x, y, radius + .4, 0, Math.PI * 2); ctx.strokeStyle = color + '80'; ctx.lineWidth = .7; ctx.stroke();
    if (Number(node.id.slice(-1)) % 3 === 0) {
      ctx.beginPath(); ctx.ellipse(x, y, radius * 1.9, radius * .55, -.4, 0, Math.PI * 2); ctx.strokeStyle = color + '66'; ctx.lineWidth = Math.max(1, radius * .12); ctx.stroke();
    }
  }
  frame(now) {
    if (this.disposed) return;
    if (this.flight) {
      const t = clamp((now - this.flight.start) / 850, 0, 1), eased = t * t * (3 - 2 * t);
      this.target = this.flight.fromTarget.map((v, i) => v + (this.flight.target[i] - v) * eased);
      this.distance = this.flight.fromDistance + (this.flight.distance - this.flight.fromDistance) * eased;
      if (t === 1) this.flight = null;
    }
    this.basis(); this.updateExpansion();
    const level = this.expanded?.id || null;
    if (level !== this.lastLevel) { this.lastLevel = level; this.onLevel(this.expanded); }
    this.draw(now / 1000);
    if (this.lastTime) { this.frames.push(now - this.lastTime); if (this.frames.length > 120) this.frames.shift(); }
    this.lastTime = now;
    if (!this.lastStats || now - this.lastStats > 1000) {
      const sorted = [...this.frames].sort((a, b) => a - b);
      this.onStats({ fps: Math.round(1000 / (this.frames.reduce((a, b) => a + b, 0) / this.frames.length || 16.7)), p95: Math.round(sorted[Math.floor(sorted.length * .95)] || 0), nodes: this.hitNodes.length, dpr: this.dpr }); this.lastStats = now;
    }
    this.raf = requestAnimationFrame(t => this.frame(t));
  }
  draw(time) {
    const ctx = this.ctx; ctx.clearRect(0, 0, this.width, this.height); ctx.fillStyle = '#070a12'; ctx.fillRect(0, 0, this.width, this.height);
    ctx.save(); ctx.translate(this.width * .54, this.height * .49); ctx.scale(1.8, .7);
    this.glow(0, 0, this.width * .48, '#746aa8', .055); ctx.restore();
    const count = { low: 600, medium: 1400, high: 2200 }[this.quality];
    for (let i = 0; i < count; i++) {
      const star = this.stars[i]; const x = ((star.x * this.width - this.yaw * 50 - this.target[0] * .003) % this.width + this.width) % this.width;
      const y = ((star.y * this.height + this.pitch * 20 + this.target[1] * .003) % this.height + this.height) % this.height;
      ctx.globalAlpha = (.15 + star.size * .42) * (this.reducedMotion ? 1 : .85 + .15 * Math.sin(time * .3 + star.phase)); ctx.fillStyle = '#b9c6e2'; ctx.fillRect(x, y, star.size > .97 ? 1.8 : .9, star.size > .97 ? 1.8 : .9);
    }
    ctx.globalAlpha = 1;
    const cloudLabels = [];
    for (const [index, genre] of genres.entries()) {
      const p = this.project(genre.position); if (!p) continue;
      const opacity = this.filter.genreId && this.filter.genreId !== genre.id ? .1 : .9;
      this.nebula(genre, index, opacity);
      const dust = this.cloudModels[index].dust;
      const dustStride = { low: 4, medium: 2, high: 1 }[this.quality];
      ctx.fillStyle = genre.color;
      for (let i = 0; i < dust.length; i += dustStride) {
        const particle = dust[i], point = this.project(particle.position);
        if (!point || point.x < 0 || point.y < 0 || point.x > this.width || point.y > this.height) continue;
        const size = clamp(particle.size * point.scale * 2, .4, 1.9); ctx.globalAlpha = particle.alpha * opacity;
        ctx.fillRect(point.x, point.y, size, size);
      }
      ctx.globalAlpha = 1;
      if (this.distance > 2300) cloudLabels.push({ genre, point: p, count: this.cloudModels[index].count });
    }
    const nodes = [];
    for (const artist of artists) {
      const p = this.project(artist.position); if (!p || p.x < -40 || p.x > this.width + 40 || p.y < -40 || p.y > this.height + 40) continue;
      const matches = this.matches(artist), active = this.expanded?.id === artist.id, selected = this.selected?.id === artist.id;
      const radius = clamp((6 + Math.sqrt(artist.metrics.longTermScore) * 11) * p.scale, 1.1, active ? 15 : 6);
      nodes.push({ ...p, type: 'artist', id: artist.id, artist, radius, hitRadius: Math.max(10, radius + 5), matches, active, selected, color: artist.color, name: artist.name, metrics: artist.metrics });
    }
    if (this.expanded) {
      const artist = this.expanded;
      const center = this.project(artist.position);
      if (center) {
        ctx.save(); ctx.translate(center.x, center.y); ctx.rotate(-.35); ctx.scale(1.5, .6);
        this.glow(0, 0, 150 * center.scale, artist.color, .4); ctx.restore();
        for (let i = 0; i < 90; i++) {
          const angle = i * 2.399 + Math.sqrt(i) * .35, radius = Math.sqrt(i) * 8;
          const point = this.project([artist.position[0] + Math.cos(angle) * radius, artist.position[1] + Math.sin(angle) * radius * .35, artist.position[2] + Math.sin(angle) * radius * .4]);
          if (point) { ctx.globalAlpha = .15 + (i % 5) * .1; ctx.fillStyle = artist.color; ctx.fillRect(point.x, point.y, 1.2, 1.2); }
        }
        ctx.globalAlpha = 1;
      }
      for (let orbit = 0; orbit < 2; orbit++) {
        ctx.beginPath(); let started = false;
        for (let i = 0; i <= 80; i++) { const angle = i / 80 * Math.PI * 2, radius = 165 + orbit * 65; const p = this.project([artist.position[0] + Math.cos(angle) * radius, artist.position[1] + Math.sin(angle) * radius * .75, artist.position[2] + Math.sin(angle) * 45]); if (!p) continue; if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y); }
        ctx.strokeStyle = artist.color + '22'; ctx.lineWidth = 1; ctx.stroke();
      }
      tracksByArtist.get(artist.id).forEach((track, i) => {
        const p = this.project(trackPosition(artist, i)); if (!p) return;
        const radius = clamp((10 + Math.sqrt(track.metrics.longTermScore) * 10) * p.scale, 6, 30);
        const ringed = Number(track.id.slice(-1)) % 3 === 0;
        nodes.push({ ...p, type: 'track', id: track.id, artist, radius, hitRadius: Math.max(14, radius * (ringed ? 1.9 : 1.2) + 5), matches: true, selected: this.selected?.id === track.id, color: artist.color, name: track.title, metrics: track.metrics });
        if (center) { ctx.beginPath(); ctx.moveTo(center.x, center.y); ctx.lineTo(p.x, p.y); ctx.strokeStyle = artist.color + '0d'; ctx.stroke(); }
      });
    }
    nodes.sort((a, b) => b.depth - a.depth);
    for (const node of nodes) {
      const amplitude = this.reducedMotion ? 0 : listenerAmplitude(node.metrics.activeListeners);
      const pulse = 1 + amplitude * Math.sin(time * Math.PI * 1.3 + node.radius);
      const energy = node.id === this.playingTrackId && !this.reducedMotion ? this.energy * .08 : 0;
      const radius = node.radius * (pulse + energy);
      const alpha = node.matches ? .6 + node.metrics.recentScore * .4 : .1;
      this.glow(node.x, node.y, radius * (node.active || node.selected ? 7 : 5), node.color, node.type === 'track' ? alpha * .5 : alpha);
      ctx.globalAlpha = alpha;
      if (node.type === 'track') this.planet(node, radius, time);
      else {
        ctx.beginPath(); ctx.arc(node.x, node.y, radius, 0, Math.PI * 2); ctx.fillStyle = node.color; ctx.fill();
        ctx.beginPath(); ctx.arc(node.x, node.y, Math.max(.65, radius * .4), 0, Math.PI * 2); ctx.fillStyle = '#f7f5ff'; ctx.fill();
        if (node.metrics.recentScore > .8 || node.active) {
          ctx.beginPath(); ctx.moveTo(node.x - radius * 2.5, node.y); ctx.lineTo(node.x + radius * 2.5, node.y); ctx.moveTo(node.x, node.y - radius * 2.5); ctx.lineTo(node.x, node.y + radius * 2.5);
          ctx.strokeStyle = node.color + '50'; ctx.lineWidth = .55; ctx.stroke();
        }
      }
      if (node.selected || node.active) { ctx.beginPath(); ctx.arc(node.x, node.y, radius + 9, -.6, 1.3); ctx.arc(node.x, node.y, radius + 9, 2.55, 4.45); ctx.strokeStyle = node.color + '99'; ctx.lineWidth = .8; ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
    const labels = nodes.filter(n => n.matches && (n.type === 'track' || n.active || n.selected || this.distance < 4400)).sort((a, b) => Number(b.selected || b.type === 'track' || b.active) - Number(a.selected || a.type === 'track' || a.active) || a.depth - b.depth);
    const boxes = []; const budget = { low: 12, medium: 24, high: 40 }[this.quality];
    ctx.font = '11px "PingFang SC", sans-serif'; ctx.textAlign = 'center';
    for (const n of labels) {
      if (boxes.length >= budget) break;
      const width = ctx.measureText(n.name).width + 12, y = n.y + n.radius + 20, box = { x: n.x - width / 2, y: y - 12, w: width, h: 17 };
      if (boxes.some(b => box.x < b.x + b.w && box.x + box.w > b.x && box.y < b.y + b.h && box.y + box.h > b.y)) continue;
      boxes.push(box); ctx.strokeStyle = '#070a12d0'; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.strokeText(n.name, n.x, y);
      ctx.fillStyle = n.selected || n.type === 'track' ? '#f5f1ff' : '#e0e5ee'; ctx.fillText(n.name, n.x, y);
    }
    const vignette = ctx.createRadialGradient(this.width / 2, this.height * .5, Math.min(this.width, this.height) * .3, this.width / 2, this.height * .5, Math.max(this.width, this.height) * .68);
    vignette.addColorStop(0, '#070a1200'); vignette.addColorStop(1, '#03050bb0'); ctx.fillStyle = vignette; ctx.fillRect(0, 0, this.width, this.height);
    ctx.font = '10px "PingFang SC", sans-serif'; ctx.textAlign = 'center';
    for (const { genre, point: p, count } of cloudLabels) {
      const title = `${genre.name}星云 · ${count} 位`, y = p.y - 420 * p.scale - 12;
      const width = ctx.measureText(title).width + 16;
      ctx.fillStyle = '#070a12ba'; ctx.fillRect(p.x - width / 2, y - 12, width, 18);
      ctx.fillStyle = genre.color; ctx.fillText(title, p.x, y);
      ctx.beginPath(); ctx.moveTo(p.x, y + 6); ctx.lineTo(p.x, p.y - 310 * p.scale); ctx.strokeStyle = genre.color + '30'; ctx.lineWidth = .7; ctx.stroke();
    }
    this.hitNodes = nodes.filter(n => n.matches);
  }
  snapshot() { return { distance: this.distance, target: [...this.target], expandedArtist: this.expanded?.id || null, nodes: this.hitNodes.map(({ id, type, x, y }) => ({ id, type, x, y })) }; }
  dispose() { this.disposed = true; cancelAnimationFrame(this.raf); this.resizeObserver.disconnect(); this.listeners.forEach(remove => remove()); this.haloTextures.clear(); this.cloudTextures.clear(); }
}
