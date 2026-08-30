import { useCallback, useEffect, useRef, useState } from 'react';
import { toSpeechText } from '../lib/speechText';

export type ReadAloudStatus = 'idle' | 'speaking' | 'paused' | 'unsupported';

interface UseReadAloudOptions {
  rate?: number;
  pitch?: number;
}

interface UseReadAloudResult {
  status: ReadAloudStatus;
  speak: (text: string) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
}

/**
 * Shared browser Speech Synthesis control — start/pause/resume/stop, with the following fixed
 * relative to the three previous ad hoc copies of this logic (KidsHomePage, KidsAssessmentPage,
 * FlashcardReviewCard): real pause()/resume() (they only ever did cancel()+re-speak(), so
 * "resume" always restarted from the beginning); speech is canceled on unmount so navigating
 * away mid-utterance doesn't leave audio playing for content no longer on screen; and a status
 * guard so a late-firing onend/onerror from a just-superseded utterance can't stomp on the
 * status of whatever utterance replaced it.
 */
export function useReadAloud(options: UseReadAloudOptions = {}): UseReadAloudResult {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [status, setStatus] = useState<ReadAloudStatus>(supported ? 'idle' : 'unsupported');
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const rateRef = useRef(options.rate ?? 1);
  const pitchRef = useRef(options.pitch ?? 1.05);

  useEffect(() => {
    rateRef.current = options.rate ?? 1;
  }, [options.rate]);

  useEffect(() => {
    pitchRef.current = options.pitch ?? 1.05;
  }, [options.pitch]);

  // Voices load asynchronously in some browsers (notably Chrome on first page load) — priming
  // getVoices() and listening for voiceschanged means the first speak() call isn't stuck with an
  // empty voice list.
  useEffect(() => {
    if (!supported) return;
    window.speechSynthesis.getVoices();
    const handleVoicesChanged = () => window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
  }, [supported]);

  useEffect(() => {
    return () => {
      if (supported) window.speechSynthesis.cancel();
    };
  }, [supported]);

  const speak = useCallback(
    (text: string) => {
      if (!supported) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(toSpeechText(text));
      utterance.rate = rateRef.current;
      utterance.pitch = pitchRef.current;
      utterance.onend = () => {
        if (utteranceRef.current === utterance) setStatus('idle');
      };
      utterance.onerror = () => {
        if (utteranceRef.current === utterance) setStatus('idle');
      };
      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
      setStatus('speaking');
    },
    [supported]
  );

  const pause = useCallback(() => {
    if (!supported || status !== 'speaking') return;
    window.speechSynthesis.pause();
    setStatus('paused');
  }, [supported, status]);

  const resume = useCallback(() => {
    if (!supported || status !== 'paused') return;
    window.speechSynthesis.resume();
    setStatus('speaking');
  }, [supported, status]);

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setStatus('idle');
  }, [supported]);

  return { status, speak, pause, resume, stop };
}
