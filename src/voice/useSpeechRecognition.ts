import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type SpeechRecognitionResult = {
  readonly isFinal: boolean;
  readonly 0: { readonly transcript: string };
};

type SpeechRecognitionEvent = Event & {
  readonly resultIndex: number;
  readonly results: {
    readonly length: number;
    readonly [index: number]: SpeechRecognitionResult;
  };
};

type SpeechRecognitionErrorEvent = Event & {
  readonly error: string;
};

type SpeechRecognitionLike = EventTarget & {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

type UseSpeechRecognitionOptions = {
  enabled: boolean;
  continuous?: boolean;
  onFinalTranscript: (text: string) => void;
};

export function useSpeechRecognition({
  enabled,
  continuous = false,
  onFinalTranscript
}: UseSpeechRecognitionOptions) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const enabledRef = useRef(enabled);
  const onFinalTranscriptRef = useRef(onFinalTranscript);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [lastTranscript, setLastTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    onFinalTranscriptRef.current = onFinalTranscript;
  }, [onFinalTranscript]);

  const supported = useMemo(() => {
    if (typeof window === "undefined") return false;
    const speechWindow = window as SpeechWindow;
    return Boolean(speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition);
  }, []);

  const stop = useCallback(() => {
    enabledRef.current = false;
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const start = useCallback(() => {
    if (!supported) {
      setError("Voice input is not supported in this browser.");
      return;
    }

    const speechWindow = window as SpeechWindow;
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Recognition) return;

    recognitionRef.current?.abort();
    const recognition = new Recognition();
    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";
    recognition.onresult = (event) => {
      let interim = "";
      let final = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      setInterimTranscript(interim.trim());
      if (final.trim()) {
        const text = final.trim();
        setLastTranscript(text);
        setInterimTranscript("");
        onFinalTranscriptRef.current(text);
      }
    };
    recognition.onerror = (event) => {
      setError(event.error || "Voice input stopped.");
      setIsListening(false);
    };
    recognition.onend = () => {
      setIsListening(false);
      if (enabledRef.current && continuous) {
        window.setTimeout(() => {
          if (enabledRef.current) start();
        }, 350);
      }
    };
    recognitionRef.current = recognition;
    enabledRef.current = enabled;
    setError(null);
    setIsListening(true);
    recognition.start();
  }, [continuous, enabled, supported]);

  useEffect(() => {
    if (enabled) start();
    if (!enabled) stop();
    return () => recognitionRef.current?.abort();
  }, [enabled, start, stop]);

  return {
    supported,
    isListening,
    interimTranscript,
    lastTranscript,
    error,
    start,
    stop
  };
}
