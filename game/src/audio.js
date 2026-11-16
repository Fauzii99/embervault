// Synthesized sound. Every cue is built from oscillators and noise at call time, so the game ships
// no audio files and still has absorb, volley, hit, wave-clear and death feedback.

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;

  const ensure = () => {
    if (ctx) return ctx;
    const Ctor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    return ctx;
  };

  /** Browsers start audio suspended until a gesture; call this from the first input. */
  const unlock = () => {
    const audio = ensure();
    if (audio && audio.state === 'suspended') audio.resume();
  };

  const tone = ({ freq, endFreq, duration, type, gain, delay = 0, sweep = 'exp' }) => {
    const audio = ensure();
    if (!audio || muted) return;
    const start = audio.currentTime + delay;
    const osc = audio.createOscillator();
    const env = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (endFreq && endFreq !== freq) {
      if (sweep === 'exp') osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), start + duration);
      else osc.frequency.linearRampToValueAtTime(endFreq, start + duration);
    }
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(gain, start + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(env).connect(master);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  };

  const noise = ({ duration, gain, filterFreq, endFreq, delay = 0 }) => {
    const audio = ensure();
    if (!audio || muted) return;
    const start = audio.currentTime + delay;
    const frames = Math.max(1, Math.floor(audio.sampleRate * duration));
    const buffer = audio.createBuffer(1, frames, audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 2;
    const src = audio.createBufferSource();
    src.buffer = buffer;
    const filter = audio.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(filterFreq, start);
    if (endFreq) filter.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), start + duration);
    filter.Q.value = 1.2;
    const env = audio.createGain();
    env.gain.setValueAtTime(gain, start);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    src.connect(filter).connect(env).connect(master);
    src.start(start);
  };

  return {
    unlock,
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted: () => muted,
    /** A shot swallowed: bright, rising, one per catch, pitched up by the ring's depth. */
    absorb(depth = 0) {
      const pitch = 520 + depth * 26;
      tone({ freq: pitch, endFreq: pitch * 1.9, duration: 0.13, type: 'triangle', gain: 0.16 });
      noise({ duration: 0.08, gain: 0.05, filterFreq: 2400, endFreq: 5200 });
    },
    /** The whole ring leaving: a falling whoosh plus a low thump. */
    volley(count = 1) {
      noise({ duration: 0.34, gain: 0.16, filterFreq: 3600, endFreq: 320 });
      tone({ freq: 180 + count * 8, endFreq: 64, duration: 0.3, type: 'sawtooth', gain: 0.14 });
      tone({ freq: 660, endFreq: 240, duration: 0.2, type: 'square', gain: 0.05, delay: 0.02 });
    },
    /** A shard finding its target. */
    kill() {
      tone({ freq: 300, endFreq: 90, duration: 0.16, type: 'square', gain: 0.09 });
      noise({ duration: 0.14, gain: 0.07, filterFreq: 900, endFreq: 200 });
    },
    /** The player is hit. */
    hit() {
      tone({ freq: 150, endFreq: 46, duration: 0.44, type: 'sawtooth', gain: 0.24 });
      noise({ duration: 0.32, gain: 0.18, filterFreq: 620, endFreq: 90 });
    },
    /** A wave cleared: three notes climbing. */
    waveClear() {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, i) => tone({ freq, duration: 0.26, type: 'triangle', gain: 0.12, delay: i * 0.085 }));
    },
    /** Run over. */
    death() {
      const notes = [440, 349.23, 261.63, 174.61];
      notes.forEach((freq, i) => tone({ freq, endFreq: freq * 0.94, duration: 0.5, type: 'sine', gain: 0.16, delay: i * 0.16 }));
    },
    /** A win. */
    victory() {
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
      notes.forEach((freq, i) => tone({ freq, duration: 0.42, type: 'triangle', gain: 0.13, delay: i * 0.11 }));
    },
  };
}
