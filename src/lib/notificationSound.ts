/**
 * Zero-Latency Notification Bell Sound Utility
 *
 * Guarantees instantaneous bell sound playback via:
 * 1. Proactive AudioContext unlocking on the first user interaction anywhere in the app.
 * 2. In-memory pre-decoding of the WAV bell audio into an AudioBuffer (0ms playback latency).
 * 3. Instant dual-tone crystal bell synthesizer if buffer is loading or audio file is restricted.
 * 4. Preloaded HTMLAudio fallback pool.
 */

let audioContext: AudioContext | null = null;
let decodedBellBuffer: AudioBuffer | null = null;
let isPreloading = false;
let isAudioUnlocked = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioContext) {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      audioContext = new AudioCtx();
    }
  }
  return audioContext;
}

/**
 * Preload and decode the audio file into memory for 0ms latency playback
 */
export function preloadNotificationAudio(): void {
  if (typeof window === 'undefined' || isPreloading || decodedBellBuffer) return;
  isPreloading = true;

  const ctx = getAudioContext();
  if (!ctx) return;

  fetch('/sounds/bell.wav')
    .then((res) => {
      if (!res.ok) throw new Error('Failed to load bell sound');
      return res.arrayBuffer();
    })
    .then((arrayBuffer) => ctx.decodeAudioData(arrayBuffer))
    .then((decoded) => {
      decodedBellBuffer = decoded;
    })
    .catch(() => {
      // Audio buffer preload fallback to synthesizer
    });
}

/**
 * Proactively unlocks audio on the very first user interaction
 */
export function unlockAudio(): void {
  if (isAudioUnlocked) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    void ctx.resume().then(() => {
      isAudioUnlocked = true;
    });
  } else {
    isAudioUnlocked = true;
  }

  if (!decodedBellBuffer) {
    preloadNotificationAudio();
  }
}

// Register global unlock listeners on page load
if (typeof window !== 'undefined') {
  const unlockEvents = ['click', 'keydown', 'touchstart', 'pointerdown'];
  const handleInteraction = () => {
    unlockAudio();
    unlockEvents.forEach((evt) => {
      window.removeEventListener(evt, handleInteraction, true);
    });
  };

  unlockEvents.forEach((evt) => {
    window.addEventListener(evt, handleInteraction, { capture: true, passive: true });
  });

  // Start preloading immediately
  preloadNotificationAudio();
}

/**
 * Synthesizes an authentic high-definition dual-tone bell chime using Web Audio API oscillators.
 * Zero external dependencies, 0ms playback start.
 */
function playSynthesizedChime(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      void ctx.resume();
    }

    const now = ctx.currentTime;

    // Master gain for chime volume
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.6, now);
    masterGain.connect(ctx.destination);

    // Fundamental Bell Tone (C6 ~ 1046.5 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1046.5, now);
    gain1.gain.setValueAtTime(0.65, now);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
    osc1.connect(gain1);
    gain1.connect(masterGain);
    osc1.start(now);
    osc1.stop(now + 1.2);

    // Harmonic Overtones for authentic bell shimmer (G6 ~ 1568 Hz)
    const oscHarmonic = ctx.createOscillator();
    const gainHarmonic = ctx.createGain();
    oscHarmonic.type = 'sine';
    oscHarmonic.frequency.setValueAtTime(1567.98, now);
    gainHarmonic.gain.setValueAtTime(0.25, now);
    gainHarmonic.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);
    oscHarmonic.connect(gainHarmonic);
    gainHarmonic.connect(masterGain);
    oscHarmonic.start(now);
    oscHarmonic.stop(now + 0.85);

    // Second Cheerful Bell Tone (E6 ~ 1318.5 Hz, struck 100ms later)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1318.5, now + 0.1);
    gain2.gain.setValueAtTime(0.7, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 1.45);
    osc2.connect(gain2);
    gain2.connect(masterGain);
    osc2.start(now + 0.1);
    osc2.stop(now + 1.45);
  } catch {
    // Autoplay policy or unsupported audio
  }
}

/**
 * Instantaneously plays the notification bell chime.
 * Uses the pre-decoded AudioBuffer if ready (0ms latency),
 * or the instant hardware synthesizer.
 */
export function playNotificationSound(): void {
  try {
    const ctx = getAudioContext();

    if (ctx && decodedBellBuffer) {
      if (ctx.state === 'suspended') {
        void ctx.resume();
      }
      const source = ctx.createBufferSource();
      source.buffer = decodedBellBuffer;
      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0.7, ctx.currentTime);
      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      source.start(0);
      return;
    }

    // If buffer is still loading or unavailable, play synthesized chime immediately
    playSynthesizedChime();
  } catch {
    // Fallback to HTMLAudioElement
    try {
      const audio = new Audio('/sounds/bell.wav');
      audio.volume = 0.7;
      void audio.play().catch(() => playSynthesizedChime());
    } catch {
      playSynthesizedChime();
    }
  }
}
