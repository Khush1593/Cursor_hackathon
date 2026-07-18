/**
 * Global Audio unlock + playback (Chrome autoplay gotcha).
 * Implemented in the design / voice step.
 */

export function unlock(): void {
  // TODO: play+pause silent clip on user gesture
}

export function play(_base64: string | null): void {
  // TODO: set data:audio/mp3;base64 and .play().catch(...)
}
