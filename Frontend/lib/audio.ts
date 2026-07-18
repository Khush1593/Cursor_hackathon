/**
 * Global Audio unlock + playback (Chrome autoplay gotcha).
 *
 * Keep ONE module-level Audio element. Unlock it on the first user gesture
 * (button press) by playing a 1-frame silent clip; later set its src to the
 * backend's base64 MP3 and play. Always `.catch()` so a blocked autoplay
 * degrades silently to text.
 */

let audioEl: HTMLAudioElement | null = null;
let unlocked = false;

// 1-frame silent MP3 as a data URI, used purely to satisfy the gesture unlock.
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

/** Call inside a user gesture (mousedown/touchstart) to unlock playback. */
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

/** Play a base64 MP3 from the backend. No-op on null; never throws. */
export function play(base64: string | null): void {
  if (!base64) return;
  const el = getAudio();
  if (!el) return;
  el.src = `data:audio/mp3;base64,${base64}`;
  el.play().catch((err) => {
    console.warn("autoplay blocked, text-only", err);
  });
}
