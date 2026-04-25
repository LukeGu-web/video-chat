// src/capabilities/speak/hooks/useTTSQueue.ts

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  TTSQueueConfig,
  TTSQueueStatus,
  TTSSynthesisOptions,
} from '../../../types/speak';
import { TTSQueue } from '../queue/TTSQueue';
import { FishAudioProvider } from '../providers/FishAudioProvider';
import { globalAudioCache } from '../cache/AudioCache';
import { motionCoordinator } from '../../motion';

/**
 * useTTSQueue Hook return type
 */
export interface UseTTSQueueReturn {
  isPlaying: boolean;
  isSynthesizing: boolean;
  queueStatus: TTSQueueStatus;
  enqueue(text: string, options?: TTSSynthesisOptions): Promise<void>;
  cancel(): Promise<void>;
  waitForCompletion(): Promise<void>;
  reset(): void;
}

/**
 * TTS Queue Hook
 * Manages queued TTS synthesis and playback
 */
export function useTTSQueue(config?: TTSQueueConfig): UseTTSQueueReturn {
  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [queueStatus, setQueueStatus] = useState<TTSQueueStatus>({
    total: 0,
    pending: 0,
    synthesizing: 0,
    ready: 0,
    playing: 0,
    completed: 0,
    failed: 0,
  });

  // Queue instance
  const queueRef = useRef<TTSQueue | null>(null);
  const statusUpdateTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize queue
  useEffect(() => {
    const provider = new FishAudioProvider();
    const cache = globalAudioCache;

    const queueConfig: TTSQueueConfig = {
      ...config,
      onItemStart: (item) => {
        setIsPlaying(true);
        const hint = item.options?.animationHint ?? 'speaking';
        motionCoordinator.onTTSStart(hint);
        config?.onItemStart?.(item);
      },
      onItemEnd: (item) => {
        motionCoordinator.onTTSEnd();
        config?.onItemEnd?.(item);
        // Update status after item ends
        updateStatus();
      },
      onItemError: (item, error) => {
        config?.onItemError?.(item, error);
        updateStatus();
      },
    };

    queueRef.current = new TTSQueue(queueConfig, provider, cache);

    // Start periodic status updates
    startStatusUpdates();

    return () => {
      // Cleanup on unmount
      stopStatusUpdates();
      queueRef.current?.cancel();
      provider.cleanup();
    };
  }, []); // Only run once on mount

  // Update queue status
  const updateStatus = useCallback(() => {
    if (queueRef.current) {
      const status = queueRef.current.getStatus();
      setQueueStatus(status);
      setIsSynthesizing(status.synthesizing > 0);
      setIsPlaying(status.playing > 0);
    }
  }, []);

  // Start periodic status updates
  const startStatusUpdates = useCallback(() => {
    stopStatusUpdates();
    statusUpdateTimerRef.current = setInterval(() => {
      updateStatus();
    }, 500); // Update every 500ms
  }, [updateStatus]);

  // Stop periodic status updates
  const stopStatusUpdates = useCallback(() => {
    if (statusUpdateTimerRef.current) {
      clearInterval(statusUpdateTimerRef.current);
      statusUpdateTimerRef.current = null;
    }
  }, []);

  // Enqueue text for synthesis and playback
  const enqueue = useCallback(
    async (text: string, options?: TTSSynthesisOptions) => {
      if (!queueRef.current) {
        throw new Error('Queue not initialized');
      }

      await queueRef.current.enqueue(text, options);
      updateStatus();
    },
    [updateStatus]
  );

  // Cancel all pending items
  const cancel = useCallback(async () => {
    if (!queueRef.current) return;

    await queueRef.current.cancel();
    // Stop visemes and reset coordinator since onItemEnd is not called on cancel
    motionCoordinator.onStopVisemes();
    motionCoordinator.reset();
    setIsPlaying(false);
    setIsSynthesizing(false);
    updateStatus();
  }, [updateStatus]);

  // Wait for all items to complete
  const waitForCompletion = useCallback(async () => {
    if (!queueRef.current) return;

    await queueRef.current.waitForCompletion();
    setIsPlaying(false);
    updateStatus();
  }, [updateStatus]);

  // Reset queue for reuse
  const reset = useCallback(() => {
    if (!queueRef.current) return;

    queueRef.current.reset();
    setIsPlaying(false);
    setIsSynthesizing(false);
    updateStatus();
  }, [updateStatus]);

  return {
    isPlaying,
    isSynthesizing,
    queueStatus,
    enqueue,
    cancel,
    waitForCompletion,
    reset,
  };
}
