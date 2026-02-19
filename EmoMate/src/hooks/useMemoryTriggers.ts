import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useMemoryStore } from '../store/memoryStore';
import { useMemoryExtraction } from './useMemoryExtraction';
import { ChatMessage } from '../store/chatStore';
import { debugLog } from '../utils/debug';

const MESSAGE_COUNT_THRESHOLD = 20; // extract every 20 messages
const SILENCE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

interface UseMemoryTriggersProps {
  messages: ChatMessage[];
  enabled?: boolean;
}

export function useMemoryTriggers({ messages, enabled = true }: UseMemoryTriggersProps): void {
  const { extractAndSave, processPendingExtraction } = useMemoryExtraction();
  const { setPendingExtraction } = useMemoryStore();

  const lastExtractionIndexRef = useRef(0);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesRef = useRef(messages);

  // Keep ref in sync
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Startup check: process any pending extraction from last session
  useEffect(() => {
    if (!enabled) return;
    processPendingExtraction();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  // Message count trigger: extract every N messages
  useEffect(() => {
    if (!enabled) return;

    const unprocessedCount = messages.length - lastExtractionIndexRef.current;
    if (unprocessedCount >= MESSAGE_COUNT_THRESHOLD) {
      const segment = messages.slice(lastExtractionIndexRef.current);
      lastExtractionIndexRef.current = messages.length;
      debugLog('useMemoryTriggers', 'Message count trigger fired', { count: unprocessedCount });
      extractAndSave(segment);
    }
  }, [messages, enabled, extractAndSave]);

  // Silence trigger: extract after 5 minutes of no new messages
  const resetSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
    silenceTimerRef.current = setTimeout(() => {
      const current = messagesRef.current;
      const segment = current.slice(lastExtractionIndexRef.current);
      if (segment.length === 0) return;

      debugLog('useMemoryTriggers', 'Silence trigger fired', { segmentLength: segment.length });
      lastExtractionIndexRef.current = current.length;
      extractAndSave(segment);
    }, SILENCE_THRESHOLD_MS);
  }, [extractAndSave]);

  // Reset silence timer whenever messages change
  useEffect(() => {
    if (!enabled || messages.length === 0) return;
    resetSilenceTimer();
  }, [messages, enabled, resetSilenceTimer]);

  // Background trigger: mark pending when app goes to background
  useEffect(() => {
    if (!enabled) return;

    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (nextState === 'background' || nextState === 'inactive') {
          const current = messagesRef.current;
          const segment = current.slice(lastExtractionIndexRef.current);
          if (segment.length === 0) return;

          debugLog('useMemoryTriggers', 'Background trigger: marking pending', {
            segmentLength: segment.length,
          });
          // Fast MMKV write only — no async work here
          setPendingExtraction(true, segment);
        }
      }
    );

    return () => {
      subscription.remove();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
  }, [enabled, setPendingExtraction]);
}
