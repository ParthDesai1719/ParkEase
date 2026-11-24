/**
 * ParkEase Personalized Voice Welcome System
 *
 * Official ParkEase brand voice implementation using the native browser Web Speech API
 * (window.speechSynthesis & SpeechSynthesisUtterance).
 *
 * Voice Brand Identity & Characteristics:
 * - Voice: Female
 * - Accent: Natural Indian English (en-IN)
 * - Perceived Age: ~25–27 years (friendly, confident young professional)
 * - Pitch: Medium (1.0), warm and pleasant
 * - Tone: Friendly, welcoming and reassuring
 * - Speed: Moderate and conversational (0.95 rate)
 * - Pronunciation: Clear Indian English
 * - Delivery: Smooth, natural, human-like with genuine warmth
 *
 * Zero external dependencies, 100% free, runs client-side only.
 */

const STORAGE_KEY_ENABLED = 'parkease_voice_greeting_enabled';
const SESSION_KEY_PENDING = 'parkease_pending_voice_greeting';

/**
 * Checks if voice greeting is enabled in user preferences (defaults to true)
 */
export function isVoiceGreetingEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const stored = localStorage.getItem(STORAGE_KEY_ENABLED);
  return stored !== 'false';
}

/**
 * Sets user preference for voice greeting (persisted in localStorage)
 */
export function setVoiceGreetingEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_ENABLED, String(enabled));
  if (!enabled && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Non-blocking
    }
  }
}

/**
 * Queues a welcome greeting to be spoken once upon dashboard landing.
 * Called strictly on successful login or registration event.
 *
 * @param fullName Authenticated user's actual display name
 * @param isFirstTime True for first-time registration, false for returning user login
 */
export function queueWelcomeGreeting(fullName: string, isFirstTime: boolean = false): void {
  if (typeof window === 'undefined') return;

  const cleanName = (fullName || '').trim() || 'there';
  const payload = {
    name: cleanName,
    isFirstTime,
    timestamp: Date.now(),
  };

  try {
    sessionStorage.setItem(SESSION_KEY_PENDING, JSON.stringify(payload));
  } catch {
    // Non-blocking in private browsing or constrained environments
  }
}

/**
 * Selects the optimal Natural Indian English female voice from available speech synthesis voices.
 * Follows a strict priority hierarchy:
 * 1. Indian English (en-IN / en_IN) female voices (e.g. Heera, Neerja, Veena, Aditi, Swara, Priya)
 * 2. Any Indian English (en-IN / en_IN) voice (e.g. Google English (India))
 * 3. High-quality natural English female voices (e.g. Natural, Jenny, Aria, Samantha, Victoria)
 * 4. General English female voices
 * 5. Default English system voice
 */
function findNaturalIndianEnglishFemaleVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;

  // Filter voices by Indian English first
  const indianEnglishVoices = voices.filter(
    (v) =>
      v.lang &&
      (v.lang.toLowerCase() === 'en-in' ||
        v.lang.toLowerCase() === 'en_in' ||
        v.lang.toLowerCase().startsWith('en-in') ||
        v.lang.toLowerCase().startsWith('en_in')),
  );

  // Female voice names common in Indian English TTS engines (Windows, Edge, Chrome, macOS, Android)
  const indianFemaleKeywords = [
    'heera',
    'neerja',
    'veena',
    'aditi',
    'swara',
    'kavya',
    'priya',
    'geeta',
    'sangeeta',
    'pooja',
    'ananya',
    'female',
    'india female',
  ];

  // 1. Priority: Female Indian English voice
  if (indianEnglishVoices.length > 0) {
    for (const kw of indianFemaleKeywords) {
      const match = indianEnglishVoices.find((v) => v.name.toLowerCase().includes(kw));
      if (match) return match;
    }
    // 2. Any Indian English voice
    return indianEnglishVoices[0];
  }

  // Fallback to high-quality natural female voices across other English locales
  const englishVoices = voices.filter(
    (v) => v.lang && (v.lang.startsWith('en-') || v.lang === 'en' || v.lang.startsWith('en_')),
  );
  const pool = englishVoices.length > 0 ? englishVoices : voices;

  const naturalFemaleKeywords = [
    'natural',
    'jenny',
    'aria',
    'samantha',
    'victoria',
    'karen',
    'zira',
    'catherine',
    'fiona',
    'moira',
    'ava',
    'allison',
    'serena',
    'female',
  ];

  for (const kw of naturalFemaleKeywords) {
    const match = pool.find((v) => v.name.toLowerCase().includes(kw));
    if (match) return match;
  }

  // Default English voice fallback
  return pool.find((v) => v.lang.toLowerCase().startsWith('en')) || pool[0] || null;
}

/**
 * Speaks the greeting using native Web Speech API, tuned to the ParkEase brand voice characteristics.
 *
 * Characteristics:
 * - Rate: 0.95 (moderate, natural conversational speed)
 * - Pitch: 1.0 (medium, warm and pleasant adult pitch)
 * - Volume: 1.0 (clear and audible)
 */
export function speakGreeting(text: string): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return false;
  }

  if (!isVoiceGreetingEnabled()) {
    return false;
  }

  try {
    // Cancel any previous in-flight utterance to prevent audio overlap
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95; // Moderate, clear conversational tempo
    utterance.pitch = 1.0;  // Medium, warm, pleasant adult pitch (avoids childish/robotic extremes)
    utterance.volume = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const voice = findNaturalIndianEnglishFemaleVoice(voices);

    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang || 'en-IN';
    } else {
      utterance.lang = 'en-IN';
    }

    // Graceful error handler to prevent runtime disruption
    utterance.onerror = (e) => {
      console.warn('[ParkEase Voice Greeting] Speech playback warning:', e.error);
    };

    // If voices haven't loaded yet asynchronously, bind voiceschanged once
    if (!voices || voices.length === 0) {
      const handleVoices = () => {
        try {
          const loadedVoices = window.speechSynthesis.getVoices();
          const loadedVoice = findNaturalIndianEnglishFemaleVoice(loadedVoices);
          if (loadedVoice) {
            utterance.voice = loadedVoice;
            utterance.lang = loadedVoice.lang || 'en-IN';
          }
        } catch {
          // Non-blocking
        }
        window.speechSynthesis.removeEventListener('voiceschanged', handleVoices);
      };
      window.speechSynthesis.addEventListener('voiceschanged', handleVoices, { once: true });
    }

    window.speechSynthesis.speak(utterance);
    return true;
  } catch (err) {
    console.warn('[ParkEase Voice Greeting] Speech playback bypassed:', err);
    return false;
  }
}

/**
 * Checks if a greeting was queued from an authentic login or registration event,
 * plays it once upon landing on the dashboard, and immediately clears the pending queue
 * to prevent duplicate playback on re-renders, navigation, or page refresh.
 */
export function playPendingGreetingIfAny(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const raw = sessionStorage.getItem(SESSION_KEY_PENDING);
    if (!raw) return false;

    // Immediately remove from sessionStorage to ensure it fires only once per auth event
    sessionStorage.removeItem(SESSION_KEY_PENDING);

    const data = JSON.parse(raw);
    const { name, isFirstTime, timestamp } = data;

    // Discard stale pending greeting (older than 2 minutes)
    if (Date.now() - timestamp > 120000) {
      return false;
    }

    // Exact required brand welcome messages
    const message = isFirstTime
      ? `Welcome to ParkEase, ${name}! We're happy to have you here.`
      : `Welcome back to ParkEase, ${name}! It's great to see you again.`;

    // Slight delay of 600ms to allow dashboard transition and browser audio context readiness
    setTimeout(() => {
      speakGreeting(message);
    }, 600);

    return true;
  } catch {
    return false;
  }
}

/**
 * Replays the welcome greeting on-demand when the user clicks the speaker icon in the header.
 */
export function replayGreeting(fullName: string): void {
  const cleanName = (fullName || '').trim() || 'there';
  const message = `Welcome back to ParkEase, ${cleanName}! It's great to see you again.`;
  speakGreeting(message);
}
