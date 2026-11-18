// Subtle Web Audio API mechanical keypress feedback (tanpa file audio eksternal)
let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playKeySound(type: 'correct' | 'error' | 'complete'): void {
  const ctx = getCtx();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  if (type === 'correct') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520 + Math.random() * 60, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.03);
    gain.gain.setValueAtTime(0.055, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.032);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.035);
  } else if (type === 'error') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.07);
    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  } else {
    // Complete chime
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(freq, now + i * 0.07);
      g.gain.setValueAtTime(0.06, now + i * 0.07);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.25);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(now + i * 0.07);
      o.stop(now + i * 0.07 + 0.26);
    });
  }
}
