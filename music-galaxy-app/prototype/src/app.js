import { artists, genres, artistById, trackById, tracksByArtist } from './catalog.js';
import { GalaxyEngine } from './galaxy.js';
import { DemoPlayer } from './player.js';

const $ = id => document.getElementById(id);
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const state = { selected: null, filter: { genreId: '', region: '' }, reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches };
let engine, notifyTimer;
const formatTime = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
function notify(message) { $('notice').textContent = message; $('notice').hidden = false; clearTimeout(notifyTimer); notifyTimer = setTimeout(() => { $('notice').hidden = true; }, 4500); }
function listenersText(value) { return value === null ? '未知' : `${value} 人`; }
const player = new DemoPlayer(snapshot => {
  const track = trackById.get(snapshot.trackId), artist = track && artistById.get(track.artistId);
  $('play-toggle').disabled = !track;
  $('play-toggle').textContent = snapshot.status === 'playing' ? 'Ⅱ' : '▶';
  $('play-toggle').setAttribute('aria-label', snapshot.status === 'playing' ? '暂停' : '播放合成演示音频');
  $('player-title').textContent = track?.title || '让好奇心带路';
  $('player-subtitle').textContent = track ? `${artist.name} · 合成演示音频，非真实作品` : '点一颗歌手星，靠近后发现歌曲';
  $('elapsed').textContent = formatTime(snapshot.elapsed); $('progress').value = snapshot.elapsed;
  if (engine) { engine.playingTrackId = snapshot.status === 'playing' ? snapshot.trackId : null; engine.energy = player.energy(); }
  const button = $('detail-play');
  if (button) button.textContent = snapshot.status === 'playing' && snapshot.trackId === state.selected?.id ? 'Ⅱ 暂停演示试听' : '▶ 播放演示试听';
});
function select(entity, { focus = false } = {}) {
  state.selected = entity; engine?.setSelected(entity); $('detail-panel').hidden = false;
  const track = entity.type === 'track' ? trackById.get(entity.id) : null;
  const artist = artistById.get(track ? track.artistId : entity.id);
  if (!artist) return;
  if (focus) engine?.focusArtist(artist.id);
  $('intro').classList.add('quiet');
  const genre = genres.find(g => g.id === artist.genreId);
  const neighbors = artists.filter(a => a.genreId === artist.genreId && a.id !== artist.id).slice(0, 4);
  const metric = track?.metrics || artist.metrics;
  $('detail-panel').innerHTML = `<div class="panel-heading"><span class="eyebrow" style="margin:0">${track ? 'TRACK / 歌曲星球' : 'ARTIST / 歌手星系'}</span><button class="icon-button" data-action="close" aria-label="关闭详情">×</button></div>
    <div class="detail-orb" style="--orb-color:${artist.color}"><span></span></div><h2>${escape(track?.title || artist.name)}</h2>
    <p><span class="tag">${escape(genre.name)}</span><span class="tag">${track ? escape(artist.name) : '虚构歌手'}</span><span class="tag">演示</span></p>
    <p class="description">${track ? '45 秒本地合成声音，用于体验播放与星球律动，不是该虚构歌曲的真实录音。播放时可以继续漫游。' : escape(artist.description)}</p>
    <div class="metric-row"><span>模拟共同收听 · 演示</span><strong>${listenersText(metric.activeListeners)}</strong></div>
    ${track ? '<button class="primary-button" id="detail-play" data-action="play">▶ 播放演示试听</button><button class="primary-button" data-action="artist">查看歌手星系</button>' : '<button class="primary-button" data-action="focus">靠近这位歌手 ↗</button><p class="muted">也可以直接移动、缩放靠近；歌曲会自然展开。</p>'}
    <div class="section-caption">${track ? '同一星系的歌曲' : '星系里的歌曲'}</div>
    ${tracksByArtist.get(artist.id).map((t, i) => `<div class="track-row"><span class="track-dot"></span><button data-track="${t.id}">${escape(t.title)}</button><small>0:45</small></div>`).join('')}
    <div class="section-caption">继续发现 · 演示风格相近</div><div class="neighbors">${neighbors.map(a => `<button data-artist="${a.id}">${escape(a.name)}</button>`).join('')}</div>`;
  if (track && !player.track) player.select(track);
}
function showHover(hit, x, y) {
  const tooltip = $('tooltip'); tooltip.hidden = !hit;
  if (!hit) return;
  tooltip.innerHTML = `${escape(hit.name)}<small>${hit.type === 'track' ? '歌曲星球 · 点击查看播放' : `${genres.find(g => g.id === hit.artist.genreId).name} · 靠近发现歌曲`}</small>`;
  tooltip.style.left = `${Math.min(innerWidth - 220, Math.max(8, x + 17))}px`;
  tooltip.style.top = `${Math.max(10, Math.min(innerHeight - 140, y + 17))}px`;
}
try {
  engine = new GalaxyEngine($('galaxy'), {
    onSelect: entity => select(entity), onHover: showHover,
    onLevel: artist => { $('location').textContent = artist ? `${artist.name} / 歌曲星系` : '宇宙漫游'; $('intro').classList.toggle('quiet', Boolean(artist || state.selected)); },
    onStats: stats => { $('stats').textContent = `${stats.fps} FPS · P95 帧间隔 ${stats.p95} ms · 像素比 ${stats.dpr}\n${stats.nodes} 个可点击节点（本机测量）`; }
  }); engine.setReducedMotion(state.reducedMotion);
} catch (error) { notify(error.message); $('catalog-panel').hidden = false; }
$('reduced-motion').checked = state.reducedMotion;
function renderResults() {
  const query = $('search').value.trim().toLowerCase();
  const filtered = artists.filter(a => (!state.filter.genreId || a.genreId === state.filter.genreId) && (!state.filter.region || a.region === state.filter.region));
  const matches = [];
  for (const artist of filtered) {
    if (!query || artist.name.toLowerCase().includes(query)) matches.push({ type: 'artist', id: artist.id, title: artist.name, subtitle: `${genres.find(g => g.id === artist.genreId).name} · 虚构歌手` });
    if (query) for (const track of tracksByArtist.get(artist.id)) if (track.title.toLowerCase().includes(query)) matches.push({ type: 'track', id: track.id, title: track.title, subtitle: `${artist.name} · 演示歌曲` });
  }
  $('result-count').textContent = `${matches.length} 个结果`;
  $('visible-count').textContent = `${filtered.length} 位匹配歌手`;
  $('results').innerHTML = matches.length ? matches.map(item => `<button class="result" data-id="${item.id}" data-type="${item.type}"><strong>${escape(item.title)}</strong><small>${escape(item.subtitle)}</small></button>`).join('') : '<p class="empty-state">这片星域暂时没有匹配结果。试试清除筛选，或换一个名字。</p>';
}
function applyFilters() {
  engine?.setFilters({ ...state.filter }); renderResults();
  document.querySelectorAll('[data-genre]').forEach(button => { const active = button.dataset.genre === state.filter.genreId; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); });
}
$('genre-buttons').innerHTML = genres.map(g => `<button class="genre-button" data-genre="${g.id}" style="--genre:${g.color}" aria-pressed="false"><i></i>${g.name}</button>`).join('');
$('genre-buttons').addEventListener('click', e => {
  const button = e.target.closest('[data-genre]'); if (!button) return;
  state.filter.genreId = state.filter.genreId === button.dataset.genre ? '' : button.dataset.genre; applyFilters();
  if (state.filter.genreId) { const genre = genres.find(g => g.id === state.filter.genreId); engine?.fly(genre.position, 2000); $('intro').classList.add('quiet'); }
});
$('region').addEventListener('change', () => { state.filter.region = $('region').value; applyFilters(); });
$('clear-filters').addEventListener('click', () => { state.filter = { genreId: '', region: '' }; $('region').value = ''; $('search').value = ''; applyFilters(); });
$('search').addEventListener('input', renderResults);
$('search-toggle').addEventListener('click', () => { $('catalog-panel').hidden = !$('catalog-panel').hidden; if (!$('catalog-panel').hidden) $('search').focus(); });
$('search-close').addEventListener('click', () => { $('catalog-panel').hidden = true; $('search-toggle').focus(); });
$('results').addEventListener('click', e => { const button = e.target.closest('[data-id]'); if (!button) return; select({ type: button.dataset.type, id: button.dataset.id }, { focus: true }); $('catalog-panel').hidden = true; });
$('detail-panel').addEventListener('click', async e => {
  const trackButton = e.target.closest('[data-track]'), artistButton = e.target.closest('[data-artist]');
  if (trackButton) { select({ type: 'track', id: trackButton.dataset.track }); return; }
  if (artistButton) { select({ type: 'artist', id: artistButton.dataset.artist }, { focus: true }); return; }
  const action = e.target.closest('[data-action]')?.dataset.action;
  const artistId = state.selected?.type === 'track' ? trackById.get(state.selected.id).artistId : state.selected?.id;
  if (action === 'close') { $('detail-panel').hidden = true; $('galaxy').focus(); }
  if (action === 'focus') engine?.focusArtist(artistId);
  if (action === 'artist') select({ type: 'artist', id: artistId });
  if (action === 'play') {
    try { player.select(trackById.get(state.selected.id)); await player.toggle(); }
    catch (error) { notify(`播放失败：${error.message}`); }
  }
});
$('play-toggle').addEventListener('click', async () => { try { await player.toggle(); } catch (error) { notify(`播放失败：${error.message}`); } });
$('volume').addEventListener('input', () => player.setVolume(Number($('volume').value)));
$('home').addEventListener('click', () => { engine?.home(); $('detail-panel').hidden = true; state.selected = null; engine?.setSelected(null); $('intro').classList.remove('quiet'); });
$('zoom-in').addEventListener('click', () => engine?.zoom(.75)); $('zoom-out').addEventListener('click', () => engine?.zoom(1.33));
$('settings-toggle').addEventListener('click', () => { $('settings-panel').hidden = !$('settings-panel').hidden; });
$('settings-close').addEventListener('click', () => { $('settings-panel').hidden = true; $('settings-toggle').focus(); });
$('quality').addEventListener('change', () => engine?.setQuality($('quality').value));
$('reduced-motion').addEventListener('change', () => { state.reducedMotion = $('reduced-motion').checked; engine?.setReducedMotion(state.reducedMotion); });
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', e => { state.reducedMotion = e.matches; $('reduced-motion').checked = e.matches; engine?.setReducedMotion(e.matches); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { $('catalog-panel').hidden = true; $('detail-panel').hidden = true; $('settings-panel').hidden = true; $('galaxy').focus(); } });
window.addEventListener('pagehide', () => { engine?.dispose(); player.dispose(); });
window.addEventListener('pageshow', e => { if (e.persisted) location.reload(); });
renderResults();
// Read-only diagnostic surface for local QA; does not provide a second navigation path.
window.musicGalaxy = { snapshot: () => ({ scene: engine?.snapshot(), playback: player.snapshot(), selected: state.selected, filters: { ...state.filter } }) };
