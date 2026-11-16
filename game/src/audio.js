// Web Audio synthesis only. The context is created on the first gesture so browsers allow it,
// and every cue is built from oscillators and one generated noise buffer.

export function createAudio() {
  let ctx = null;
  let master = null;
  let noise = null;

  const unlock = () => {
    if (!ctx) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return;
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = 0.42;
      master.connect(ctx.destination);
      noise = buildNoise(ctx);
    }
    if (ctx.state === 'suspended') ctx.resume();
  };

  const tone = (freq, at, dur, type = 'triangle', gain = 0.14, endFreq = null) => {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), at + dur);
    amp.gain.setValueAtTime(0.0001, at);
    amp.gain.exponentialRampToValueAtTime(gain, at + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(amp).connect(master);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  };

  const hiss = (at, dur, gain, filterType, from, to) => {
    if (!ctx || !noise) return;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(from, at);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, to), at + dur);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(gain, at);
    amp.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(filter).connect(amp).connect(master);
    src.start(at);
    src.stop(at + dur + 0.02);
  };

  return {
    unlock,
    absorb(depth) {
      if (!ctx) return;
      const now = ctx.currentTime;
      const base = 620 + Math.min(15, depth) * 46;
      tone(base, now, 0.11, 'triangle', 0.1, base * 1.9);
      tone(base * 2.02, now + 0.008, 0.07, 'sine', 0.045);
    },
    volley(count) {
      if (!ctx) return;
      const now = ctx.currentTime;
      const weight = Math.min(1, count / 16);
      hiss(now, 0.3 + weight * 0.12, 0.16, 'bandpass', 2400, 260);
      tone(160 + weight * 40, now, 0.26, 'sine', 0.2 + weight * 0.1, 48);
    },
    kill() {
      if (!ctx) return;
      const now = ctx.currentTime;
      hiss(now, 0.07, 0.12, 'highpass', 1600, 700);
      tone(240, now, 0.09, 'square', 0.07, 90);
    },
    hit() {
      if (!ctx) return;
      const now = ctx.currentTime;
      tone(130, now, 0.34, 'sawtooth', 0.2, 42);
      hiss(now, 0.26, 0.16, 'lowpass', 900, 120);
    },
    waveClear() {
      if (!ctx) return;
      const now = ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, now + i * 0.1, 0.2, 'triangle', 0.1));
    },
    death() {
      if (!ctx) return;
      const now = ctx.currentTime;
      [440, 392, 329.63, 220].forEach((f, i) => tone(f, now + i * 0.15, 0.26, 'sawtooth', 0.11));
      hiss(now, 0.6, 0.08, 'lowpass', 800, 80);
    },
    victory() {
      if (!ctx) return;
      const now = ctx.currentTime;
      [523.25, 659.25, 783.99, 987.77, 1318.5].forEach((f, i) => tone(f, now + i * 0.12, 0.34, 'triangle', 0.12));
    },
  };
}

function buildNoise(ctx) {
  const length = Math.floor(ctx.sampleRate * 0.7);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let value = 0x2f6e2b1;
  for (let i = 0; i < length; i += 1) {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    value >>>= 0;
    data[i] = (value / 2147483648 - 1) * 0.7;
  }
  return buffer;
}
