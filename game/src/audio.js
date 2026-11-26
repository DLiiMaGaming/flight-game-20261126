// Synthesised sound only — no audio files, no network. A low engine drone
// that follows the throttle, a chime for a cleared ring, a thud for a crash.
// Everything is guarded: no gesture, no AudioContext, no crash of the game.

export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (started || muted) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 52;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
      started = true;
    } catch {
      // Sound is garnish; a silent game still flies.
    }
  }

  function tone(freq, dur, type, vol, when = 0) {
    if (!ctx || muted) return;
    try {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      const t0 = ctx.currentTime + when;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(vol, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    } catch {
      // ignore
    }
  }

  return {
    unlock: ensure,
    setMuted(m) {
      muted = m;
      if (engineGain) engineGain.gain.value = 0;
    },
    isMuted() {
      return muted;
    },
    engine(throttle, speedNorm) {
      if (!ctx || !engineOsc || muted) return;
      try {
        engineOsc.frequency.value = 46 + throttle * 44 + speedNorm * 18;
        engineGain.gain.setTargetAtTime(0.015 + throttle * 0.05, ctx.currentTime, 0.1);
      } catch {
        // ignore
      }
    },
    ring() {
      tone(880, 0.5, 'sine', 0.16);
      tone(1318, 0.6, 'sine', 0.12, 0.09);
    },
    land() {
      tone(523, 0.4, 'sine', 0.15);
      tone(784, 0.7, 'sine', 0.14, 0.12);
    },
    crash() {
      if (!ctx || muted) return;
      try {
        const len = ctx.sampleRate * 0.5;
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) {
          data[i] = (Math.random() * 2 - 1) * (1 - i / len);
        }
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const gain = ctx.createGain();
        gain.gain.value = 0.3;
        src.connect(gain);
        gain.connect(ctx.destination);
        src.start();
      } catch {
        // ignore
      }
    },
  };
}
