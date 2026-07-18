"use client";

/**
 * Push-to-Talk via the browser Web Speech API (Chrome/Edge, HTTPS or localhost).
 *
 * - press(): unlock audio (gesture) + start recognition
 * - release(): stop recognition; the final transcript is sent via sendTurn()
 *
 * No silence detection — the transcript is only sent on release. If the API is
 * unavailable the hook still works via the on-screen text fallback in the UI.
 */

import { useCallback, useRef, useSyncExternalStore } from "react";
import { unlock } from "@/lib/audio";
import { useAuraStore } from "@/store/aura.store";

/* Minimal typings for the vendor-prefixed Web Speech API. */
type SpeechRecognitionResultLike = {
  0: { transcript: string };
  isFinal: boolean;
};
interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const noop = () => () => {};

export function usePushToTalk() {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const transcriptRef = useRef("");

  // Stable browser capability — read without a cascading effect.
  const supported = useSyncExternalStore(
    noop,
    () => getRecognitionCtor() !== null,
    () => true,
  );

  const setRecording = useAuraStore((s) => s.setRecording);
  const setLiveTranscript = useAuraStore((s) => s.setLiveTranscript);
  const sendTurn = useAuraStore((s) => s.sendTurn);

  const press = useCallback(() => {
    unlock();
    transcriptRef.current = "";
    setLiveTranscript("");

    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      // Unsupported browser: still flag recording so the UI shows text input.
      setRecording(true);
      return;
    }

    const recognition = new Ctor();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i += 1) {
        text += e.results[i][0].transcript;
      }
      transcriptRef.current = text;
      setLiveTranscript(text);
    };
    recognition.onerror = () => {};
    recognition.onend = () => {};

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setRecording(true);
    } catch {
      setRecording(false);
    }
  }, [setLiveTranscript, setRecording]);

  const release = useCallback(() => {
    setRecording(false);
    const recognition = recognitionRef.current;
    if (recognition) {
      recognition.stop();
      recognitionRef.current = null;
    }
    const final = transcriptRef.current.trim();
    if (final) void sendTurn(final);
  }, [sendTurn, setRecording]);

  /** Fallback for browsers without the Web Speech API (typed text). */
  const submitText = useCallback(
    (text: string) => {
      void sendTurn(text);
    },
    [sendTurn],
  );

  return { press, release, submitText, supported };
}
