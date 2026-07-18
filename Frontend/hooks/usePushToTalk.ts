/**
 * Web Speech API Push-to-Talk hook.
 * Implemented in the design / voice step.
 */

export function usePushToTalk() {
  return {
    isRecording: false,
    start: () => {},
    stop: () => {},
  };
}
