/**
 * Global Audio unlock + playback (Chrome autoplay gotcha).
 *
 * Prefer backend `audio_base64` MP3 when present. If the API returns null,
 * fall back to the browser SpeechSynthesis API so Aura still talks —
 * making the experience a conversation, not just text chat.
 */

let audioEl: HTMLAudioElement | null = null;
let unlocked = false;

const SILENT_MP3 =
  "data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCA";

function getAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!audioEl) {
    audioEl = new Audio();
    audioEl.preload = "auto";
  }
  return audioEl;
}

/** Call inside a user gesture (click) to unlock HTMLAudio playback. */
export function unlock(): void {
  const el = getAudio();
  if (!el || unlocked) return;
  el.src = SILENT_MP3;
  el.play()
    .then(() => {
      el.pause();
      el.currentTime = 0;
      unlocked = true;
    })
    .catch(() => {
      /* will retry on the next gesture */
    });
}

/** Stop any in-progress spoken reply (MP3 or TTS). */
export function stopSpeaking(): void {
  if (typeof window === "undefined") return;
  const el = getAudio();
  if (el) {
    el.pause();
    el.currentTime = 0;
  }
  window.speechSynthesis?.cancel();
}

/** Play a base64 MP3 from the backend. No-op on null; never throws. */
export function play(base64: string | null): void {
  if (!base64) return;
  stopSpeaking();
  const el = getAudio();
  if (!el) return;
  el.src = `data:audio/mp3;base64,${base64}`;
  el.play().catch((err) => {
    console.warn("autoplay blocked, text-only", err);
  });
}

/**
 * Speak Aura's reply. Uses backend audio when available; otherwise browser TTS.
 * Call from a path that already unlocked audio via a user gesture when possible.
 */
export function speakReply(text: string, audioBase64: string | null): void {
  const clean = text.trim();
  if (!clean && !audioBase64) return;

  if (audioBase64) {
    play(audioBase64);
    return;
  }

  if (typeof window === "undefined" || !window.speechSynthesis || !clean) return;

  stopSpeaking();
  const utter = new SpeechSynthesisUtterance(clean);
  utter.lang = "en-US";
  utter.rate = 1;
  utter.pitch = 1;
  // Prefer a natural English voice when the browser exposes one.
  const voices = window.speechSynthesis.getVoices();
  const preferred =
    voices.find(
      (v) => /en[-_]US/i.test(v.lang) && /female|samantha|google/i.test(v.name),
    ) ??
    voices.find((v) => /en[-_]US/i.test(v.lang)) ??
    voices.find((v) => /^en/i.test(v.lang));
  if (preferred) utter.voice = preferred;
  window.speechSynthesis.speak(utter);
}
