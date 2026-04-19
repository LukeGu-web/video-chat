/**
 * Proactive Conversation Hook
 *
 * This module manages the proactive conversation system, which automatically
 * initiates conversation when the user is silent for a certain period.
 *
 * Features:
 * - Graduated silence detection (short, medium, long pauses)
 * - Context-aware topic selection based on conversation history
 * - Automatic TTS playback for proactive messages
 * - Enable/disable control with proper cleanup
 *
 * @module useProactiveConversation
 */

import { useRef, useCallback, useEffect } from 'react';
import {
  PROACTIVE_CONVERSATION_CONFIG,
  selectProactiveTopic,
  FISH_AUDIO_CONFIG,
} from '../../constants/ai';
import { TTSQueue } from '../../capabilities/speak';
import { lipSyncBridge } from '../../capabilities/speak/lipSyncBridge';
import { ChatMessage } from '../useChatAI';
import { useTopicSeeds } from './useTopicSeeds';

/**
 * Proactive conversation hook configuration
 */
export interface ProactiveConversationConfig {
  enabled: boolean;
  messages: ChatMessage[];
  isLoading: boolean;
  isSpeaking: boolean;
  onProactiveMessage: (content: string) => Promise<void>;
  onSpeakingStateChange?: (isSpeaking: boolean, segment: string) => void;
}

/**
 * Proactive conversation hook return value
 */
export interface UseProactiveConversationReturn {
  startTimer: () => void;
  stopTimer: () => void;
  resetTimer: () => void;
  isActive: boolean;
}

/**
 * Custom hook for managing proactive conversation
 *
 * Automatically triggers conversation starters after periods of silence:
 * - Short pause: Gentle check-in
 * - Medium pause: Topic-specific follow-up
 * - Long pause: Deeper engagement attempt
 *
 * @param config - Proactive conversation configuration
 * @returns Control interface for proactive conversation
 */
export const useProactiveConversation = (
  config: ProactiveConversationConfig
): UseProactiveConversationReturn => {
  const {
    enabled,
    messages,
    isLoading,
    isSpeaking,
    onProactiveMessage,
    onSpeakingStateChange,
  } = config;

  const topicSeeds = useTopicSeeds();

  // State refs
  const lastUserMessageTime = useRef<number>(Date.now());
  const proactiveTimer = useRef<NodeJS.Timeout | null>(null);
  const hasShownProactiveMessage = useRef<boolean>(false);
  const proactiveTTSQueue = useRef<TTSQueue | null>(null);

  /**
   * Clear the proactive conversation timer
   */
  const clearTimer = useCallback(() => {
    if (proactiveTimer.current) {
      clearTimeout(proactiveTimer.current);
      proactiveTimer.current = null;
    }
  }, []);

  /**
   * Send a proactive message with TTS
   */
  const sendProactiveMessageInternal = useCallback(
    async (content: string) => {
      if (!content.trim() || !enabled) return;

      // Call the parent's message handler
      await onProactiveMessage(content);

      // Play TTS for proactive message
      setTimeout(async () => {
        try {
          const voiceId = FISH_AUDIO_CONFIG.voices.lanlan;
          const ttsQueue = new TTSQueue({
            onItemStart: (item) => {
              onSpeakingStateChange?.(true, item.text);
            },
            onItemEnd: () => {
              onSpeakingStateChange?.(false, '');
            },
          });
          proactiveTTSQueue.current = ttsQueue;

          await ttsQueue.enqueue(content, { voiceId, emotion: 'caring' });
          await ttsQueue.waitForCompletion();
        } catch (error) {
          // TTS error handled silently
          console.warn('[ProactiveConversation] TTS error:', error);
        } finally {
          proactiveTTSQueue.current = null;
        }
      }, 300);
    },
    [enabled, onProactiveMessage, onSpeakingStateChange]
  );

  /**
   * Start the proactive conversation timer
   * Implements graduated silence detection
   */
  const startTimer = useCallback(() => {
    if (!enabled || isLoading || isSpeaking) {
      console.log('[ProactiveConversation] Timer not started:', {
        enabled,
        isLoading,
        isSpeaking,
      });
      return;
    }

    clearTimer();
    hasShownProactiveMessage.current = false;

    console.log('[ProactiveConversation] Starting timer...');

    // Short pause detection
    proactiveTimer.current = setTimeout(() => {
      if (!hasShownProactiveMessage.current && enabled) {
        console.log('[ProactiveConversation] Short pause detected');
        hasShownProactiveMessage.current = true;
        const memoryHook = messages.length === 0 ? topicSeeds[0]?.hook : undefined;
        const topic = memoryHook ?? selectProactiveTopic('short', messages);
        sendProactiveMessageInternal(topic);

        // Medium pause detection
        proactiveTimer.current = setTimeout(() => {
          if (enabled) {
            console.log('[ProactiveConversation] Medium pause detected');
            const mediumTopic = selectProactiveTopic('medium', messages);
            sendProactiveMessageInternal(mediumTopic);

            // Long pause detection
            proactiveTimer.current = setTimeout(() => {
              if (enabled) {
                console.log('[ProactiveConversation] Long pause detected');
                const longTopic = selectProactiveTopic('long', messages);
                sendProactiveMessageInternal(longTopic);
              }
            }, PROACTIVE_CONVERSATION_CONFIG.silenceDetection.longPause - PROACTIVE_CONVERSATION_CONFIG.silenceDetection.mediumPause);
          }
        }, PROACTIVE_CONVERSATION_CONFIG.silenceDetection.mediumPause - PROACTIVE_CONVERSATION_CONFIG.silenceDetection.shortPause);
      }
    }, PROACTIVE_CONVERSATION_CONFIG.silenceDetection.shortPause);
  }, [
    enabled,
    isLoading,
    isSpeaking,
    messages,
    topicSeeds,
    clearTimer,
    sendProactiveMessageInternal,
  ]);

  /**
   * Stop the proactive conversation timer
   */
  const stopTimer = useCallback(() => {
    console.log('[ProactiveConversation] Stopping timer');
    clearTimer();

    // Also stop any ongoing proactive TTS
    if (proactiveTTSQueue.current) {
      proactiveTTSQueue.current.cancel();
      // Close VRM mouth immediately since onItemEnd is not called on cancel
      lipSyncBridge.sendVRMCommand({ type: 'stopVisemes' });
      proactiveTTSQueue.current = null;
    }
  }, [clearTimer]);

  /**
   * Reset the timer (restart from beginning)
   */
  const resetTimer = useCallback(() => {
    console.log('[ProactiveConversation] Resetting timer');
    lastUserMessageTime.current = Date.now();
    stopTimer();
    if (enabled && !isLoading && !isSpeaking) {
      setTimeout(() => {
        startTimer();
      }, 1000);
    }
  }, [enabled, isLoading, isSpeaking, startTimer, stopTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimer();
    };
  }, [stopTimer]);

  return {
    startTimer,
    stopTimer,
    resetTimer,
    isActive: proactiveTimer.current !== null,
  };
};
