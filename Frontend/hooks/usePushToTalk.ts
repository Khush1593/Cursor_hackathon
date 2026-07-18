"use client";

/**
 * Tap-to-talk via the browser Web Speech API (Chrome/Edge, HTTPS or localhost).
 *
 * - First tap: start listening
 * - Second tap: stop listening and send
 * - Auto-stop: after ~2.2s of silence (pause), stop and send automatically
 * - submitText(): typed fallback sent as text
 */

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { stopSpeaking, unlock } from "@/lib/audio";
import { useAuraStore } from "@/store/aura.store";

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

/** Pause length before we assume the user finished speaking. */
const SILENCE_MS = 2200;
/** Safety cap if the user never speaks after tapping start. */
const MAX_LISTEN_MS = 45000;

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
  const intentionalStopRef = useRef(false);
  /** Guards against a session sending more than once (silence + tap race). */
  const sentThisSessionRef = useRef(false);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopListeningRef = useRef<() => void>(() => {});

  const supported = useSyncExternalStore(
    noop,
    () => getRecognitionCtor() !== null,
    () => true,
  );

  const isRecording = useAuraStore((s) => s.isRecording);
  const setRecording = useAuraStore((s) => s.setRecording);
  const setLiveTranscript = useAuraStore((s) => s.setLiveTranscript);
  const sendTurn = useAuraStore((s) => s.sendTurn);
  const canVoice = useAuraStore(
    (s) => s.consents.data_collection === true && s.consents.voice_recording === true,
  );
  const canText = useAuraStore((s) => s.consents.data_collection === true);

  const clearTimers = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
  }, []);

  const armSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(() => {
      // Only auto-send if we actually heard something.
      if (transcriptRef.current.trim()) {
        stopListeningRef.current();
      }
    }, SILENCE_MS);
  }, []);

  const stopListening = useCallback(() => {
    // Only the first stop in a session may send.
    if (sentThisSessionRef.current) return;
    sentThisSessionRef.current = true;

    intentionalStopRef.current = true;
    clearTimers();
    setRecording(false);
    const recognition = recognitionRef.current;
    if (recognition) {
      recognition.onresult = null;
      recognition.onend = null;
      recognition.stop();
      recognitionRef.current = null;
    }
    const final = transcriptRef.current.trim();
    if (final) void sendTurn(final, "voice");
  }, [clearTimers, sendTurn, setRecording]);

  useEffect(() => {
    stopListeningRef.current = stopListening;
  }, [stopListening]);

  const startListening = useCallback(() => {
    if (!canVoice) return;
    unlock();
    stopSpeaking();
    intentionalStopRef.current = false;
    sentThisSessionRef.current = false;
    transcriptRef.current = "";
    setLiveTranscript("");
    clearTimers();

    const Ctor = getRecognitionCtor();
    if (!Ctor) {
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
      // Every new chunk of speech resets the pause timer.
      if (text.trim()) armSilenceTimer();
    };
    recognition.onerror = () => {
      if (!intentionalStopRef.current) {
        clearTimers();
        setRecording(false);
        recognitionRef.current = null;
      }
    };
    recognition.onend = () => {
      // Some browsers end continuous recognition early — restart while still
      // in listening mode unless we intentionally stopped (tap or silence).
      if (!intentionalStopRef.current && recognitionRef.current === recognition) {
        try {
          recognition.start();
        } catch {
          clearTimers();
          setRecording(false);
          recognitionRef.current = null;
        }
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setRecording(true);
      maxTimerRef.current = setTimeout(() => {
        stopListeningRef.current();
      }, MAX_LISTEN_MS);
    } catch {
      clearTimers();
      setRecording(false);
      recognitionRef.current = null;
    }
  }, [armSilenceTimer, canVoice, clearTimers, setLiveTranscript, setRecording]);

  /** Toggle: tap once to start, tap again to stop & send. */
  const toggle = useCallback(() => {
    if (isRecording) {
      stopListening();
    } else {
      startListening();
    }
  }, [isRecording, startListening, stopListening]);

  const submitText = useCallback(
    (text: string) => {
      if (!canText) return;
      unlock();
      stopSpeaking();
      void sendTurn(text, "text");
    },
    [canText, sendTurn],
  );

  return {
    toggle,
    submitText,
    supported,
    canVoice,
    canText,
    isRecording,
  };
}
