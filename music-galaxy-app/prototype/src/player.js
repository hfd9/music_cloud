/** Locally generated demonstration sound. Never plays third-party recordings. */
export class DemoPlayer {
  constructor(onChange) { this.onChange = onChange; this.track = null; this.status = 'idle'; this.offset = 0; this.volume = .3; this.voices = new Set(); this.generation = 0; }
  ensureContext() {
    if (this.context) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) throw new Error('浏览器不支持演示音频播放');
    this.context = new AudioContext(); this.gain = this.context.createGain(); this.gain.gain.value = this.volume;
    this.analyser = this.context.createAnalyser(); this.analyser.fftSize = 256;
    this.buffer = new Uint8Array(this.analyser.frequencyBinCount);
    this.gain.connect(this.analyser); this.analyser.connect(this.context.destination);
    this.context.addEventListener('statechange', () => {
      if (this.status === 'playing' && this.context.state !== 'running') this.pause();
    });
  }
  select(track) {
    if (this.track?.id === track.id) return;
    this.stopVoices(); this.generation++; this.track = track; this.offset = 0; this.status = 'paused'; this.emit();
  }
  async play() {
    if (!this.track || this.status === 'playing') return;
    const generation = this.generation;
    this.ensureContext(); await this.context.resume();
    if (generation !== this.generation || this.status === 'playing') return;
    if (this.offset >= this.track.duration) this.offset = 0;
    this.startedAt = this.context.currentTime - this.offset; this.nextBeat = Math.ceil(this.offset / .38);
    this.status = 'playing'; this.tick(); this.timer = setInterval(() => this.tick(), 100); this.emit();
  }
  pause() {
    this.generation++;
    if (this.status === 'playing') this.offset = Math.min(this.track.duration, this.context.currentTime - this.startedAt);
    this.stopVoices(); if (this.track) this.status = 'paused'; this.emit();
  }
  toggle() { if (this.status === 'playing') { this.pause(); return Promise.resolve(); } return this.play(); }
  setVolume(value) { this.volume = value; if (this.gain) this.gain.gain.setTargetAtTime(value, this.context.currentTime, .03); }
  tick() {
    if (this.status !== 'playing') return;
    const now = this.context.currentTime, elapsed = now - this.startedAt;
    if (elapsed >= this.track.duration) { this.offset = this.track.duration; this.stopVoices(); this.status = 'ended'; this.emit(); return; }
    const root = [130.81, 146.83, 164.81, 174.61, 196, 220][this.track.seed % 6];
    const notes = [0, 7, 12, 16, 19, 16, 12, 7];
    while (this.nextBeat * .38 < Math.min(elapsed + .3, this.track.duration)) {
      const beat = this.nextBeat++, at = Math.max(now, this.startedAt + beat * .38);
      this.note(root * Math.pow(2, notes[(beat + this.track.seed) % notes.length] / 12), at, .7, .07, 'sine');
      if (beat % 8 === 0) this.note(root / 2, at, 2.6, .07, 'triangle');
    }
    this.emit();
  }
  note(frequency, at, duration, level, type) {
    const oscillator = this.context.createOscillator(), envelope = this.context.createGain();
    oscillator.type = type; oscillator.frequency.value = frequency;
    envelope.gain.setValueAtTime(0, at); envelope.gain.linearRampToValueAtTime(level, at + .035); envelope.gain.exponentialRampToValueAtTime(.0001, at + duration);
    oscillator.connect(envelope); envelope.connect(this.gain); const voice = { oscillator, envelope }; this.voices.add(voice);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); this.voices.delete(voice); };
    oscillator.start(at); oscillator.stop(at + duration + .02);
  }
  stopVoices() {
    clearInterval(this.timer); this.timer = null;
    for (const voice of this.voices) { voice.oscillator.onended = null; try { voice.oscillator.stop(); } catch {} voice.oscillator.disconnect(); voice.envelope.disconnect(); }
    this.voices.clear();
  }
  energy() { if (this.status !== 'playing') return 0; this.analyser.getByteFrequencyData(this.buffer); return Math.min(1, this.buffer.reduce((a, b) => a + b, 0) / this.buffer.length / 80); }
  snapshot() { return { trackId: this.track?.id || null, status: this.status, elapsed: this.status === 'playing' ? Math.min(this.track.duration, this.context.currentTime - this.startedAt) : this.offset }; }
  emit() { this.onChange(this.snapshot()); }
  dispose() { this.generation++; this.stopVoices(); this.status = 'idle'; this.context?.close(); }
}
