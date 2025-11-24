/**
 * AI Conversation Flow Hook
 *
 * This hook orchestrates the entire AI conversation pipeline:
 * 1. Scene understanding notification
 * 2. Object recognition (if keyword detected)
 * 3. Scene analysis (if keyword detected)
 * 4. Context preparation (background + object + recent records)
 * 5. AI message sending with TTS
 *
 * Extracted from HomeScreen.tsx runAIFlow function (192 lines) to improve
 * modularity and enable reuse across different conversation interfaces.
 *
 * @module useAIConversationFlow
 */

import { useCallback, useRef, useEffect } from 'react';
import type { ChatMessage } from '../store/chatStore';
import type { BackgroundContext } from '../utils/backgroundStory';
import type { ObjectRecognitionRecord } from '../types/scene';
import {
  buildConversationContext,
  handleObjectRecognition,
  handleSceneAnalysis,
} from '../utils/ai/buildConversationContext';
import { detectObjectKeywords } from '../capabilities/vision';
import { createRecognitionSmallTalkManager } from '../utils/objectRecognitionHelper';
import type { SmallTalkManager } from '../utils/smallTalk';

/**
 * AI conversation flow configuration
 */
export interface AIConversationFlowConfig {
  // AI message sending
  sendMessage: (
    text: string,
    config?: {
      modelType?: 'haiku' | 'sonnet';
      enableTTS?: boolean;
      backgroundStory?: string;
      sceneContext?: any;
    }
  ) => Promise<void>;

  // Scene understanding
  sceneUnderstanding: {
    notifyConversationActivity: () => void;
    analyzeScene: (frame: string, question?: string) => Promise<void>;
    currentScene: any;
  };

  // Object recognition
  objectRecognition: {
    recognizeObject: (
      frame: string,
      question: string
    ) => Promise<{ success: boolean; object: any; error?: string }>;
    records: ObjectRecognitionRecord[];
  };

  // Background context
  backgroundContext: BackgroundContext | null;

  // Chat message management
  addChatMessage: (message: ChatMessage) => void;

  // Scene update
  setCurrentScene: (scene: any) => void;

  // Toast notification
  setToast: (message: string, type: 'error' | 'success') => void;

  // Captured frame provider
  getCapturedFrame: () => string | null;

  // Message ID generator
  generateMessageId: () => string;

  // Small talk support (for voice-triggered recognition)
  smallTalkTTS?: {
    speak: (text: string, options?: any) => Promise<void>;
    stop: () => void;
  };

  // AI Status setters (for voice-triggered recognition)
  setLooking?: (value: boolean) => void;
  setThinking?: (value: boolean) => void;
}

/**
 * AI conversation flow hook return value
 */
export interface UseAIConversationFlowReturn {
  startConversation: (inputText: string) => Promise<void>;
}

/**
 * Custom hook for managing AI conversation flow
 *
 * Orchestrates the complete conversation pipeline from user input to AI response:
 * - Detects and handles object recognition keywords
 * - Detects and handles scene analysis keywords
 * - Builds conversation context from multiple sources
 * - Sends message to AI with proper context
 *
 * @param config - AI conversation flow configuration
 * @returns Control interface for starting conversations
 */
export const useAIConversationFlow = (
  config: AIConversationFlowConfig
): UseAIConversationFlowReturn => {
  const {
    sendMessage,
    sceneUnderstanding,
    objectRecognition,
    backgroundContext,
    addChatMessage,
    setCurrentScene,
    setToast,
    getCapturedFrame,
    generateMessageId,
    smallTalkTTS,
    setLooking,
    setThinking,
  } = config;

  // Small talk manager reference
  const smallTalkManagerRef = useRef<SmallTalkManager | null>(null);

  // Cleanup: Stop small talk manager when component unmounts
  // This prevents memory leaks and ensures TTS is stopped properly
  useEffect(() => {
    return () => {
      if (smallTalkManagerRef.current) {
        console.log('[AIConversationFlow] Component unmounting, stopping small talk');
        smallTalkManagerRef.current.stop();
        smallTalkManagerRef.current = null;
      }
    };
  }, []);

  /**
   * Start a new conversation with the AI
   *
   * This function implements the complete conversation flow:
   * 1. Notify scene understanding of conversation activity
   * 2. Add user message to chat history
   * 3. Check for object recognition keywords and handle if found
   * 4. Check for scene analysis keywords and handle if found
   * 5. Build conversation context from all sources
   * 6. Send message to AI with context
   *
   * @param inputText - User's input text
   */
  const startConversation = useCallback(
    async (inputText: string) => {
      if (!inputText.trim()) return;

      try {
        // Step 1: Notify scene understanding of conversation activity (smart pause)
        sceneUnderstanding.notifyConversationActivity();

        // Step 2: Add user message to chat history
        const userMessage: ChatMessage = {
          id: generateMessageId(),
          role: 'user',
          content: inputText.trim(),
          timestamp: Date.now(),
          isVoiceMessage: true,
        };
        addChatMessage(userMessage);

        // Step 3: Handle object recognition (if keyword detected)
        const capturedFrame = getCapturedFrame();

        // Check if object keyword is detected for small talk
        const objectKeyword = detectObjectKeywords(inputText);
        const hasObjectKeyword = !!objectKeyword;

        // Start small talk if object keyword detected and small talk is enabled
        if (hasObjectKeyword && smallTalkTTS && setLooking && setThinking) {
          console.log('[AIConversationFlow] 🗣️ Starting small talk for voice-triggered recognition');

          // Set AI status
          setLooking(true);
          setThinking(true);

          // Initialize and start small talk manager
          const manager = createRecognitionSmallTalkManager(
            async (text: string) => {
              console.log(`[AIConversationFlow] Playing small talk: ${text}`);
              await smallTalkTTS.speak(text, {
                voiceId: 'hkfHEbBvdQFNX4uWHqRF',
              });
            },
            () => {
              console.log('[AIConversationFlow] Stopping small talk');
              smallTalkTTS.stop();
            }
          );
          smallTalkManagerRef.current = manager;
          manager.start();
        }

        // Call object recognition handler with proper error handling and timeout protection
        // Use try-finally to ensure small talk is always stopped, even if recognition fails
        let objectResult: {
          triggered: boolean;
          context: string | null;
          error: string | null;
        };

        try {
          // Add timeout protection for object recognition (15 seconds)
          const RECOGNITION_TIMEOUT = 15000; // 15 seconds

          const recognitionPromise = handleObjectRecognition(
            inputText,
            capturedFrame,
            objectRecognition
          );

          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('识别超时，请重试')), RECOGNITION_TIMEOUT);
          });

          objectResult = await Promise.race([recognitionPromise, timeoutPromise]);
        } catch (error) {
          console.error('[AIConversationFlow] Recognition error or timeout:', error);

          // Handle timeout or other errors gracefully
          const errorMsg = error instanceof Error ? error.message : '识别失败';
          setToast(errorMsg, 'error');

          // Return empty result to allow conversation to continue
          objectResult = {
            triggered: false,
            context: null,
            error: errorMsg,
          };
        } finally {
          // CRITICAL: Always stop small talk and clear status, even if recognition throws
          // This prevents memory leaks and audio conflicts
          if (smallTalkManagerRef.current) {
            console.log('[AIConversationFlow] Recognition complete (or failed), stopping small talk');
            smallTalkManagerRef.current.stop();
            smallTalkManagerRef.current = null;
          }

          // Clear AI status
          if (hasObjectKeyword && setLooking && setThinking) {
            setLooking(false);
            setThinking(false);
          }
        }

        // Show error toast if object recognition failed
        if (objectResult.error) {
          setToast(objectResult.error, 'error');
          // Continue anyway - don't block the conversation
        }

        // Step 4: Handle scene analysis (if keyword detected and no object keyword)
        // Only trigger scene analysis if object recognition wasn't triggered
        let sceneResult = { triggered: false, error: null as string | null };
        if (!objectResult.triggered) {
          sceneResult = await handleSceneAnalysis(
            inputText,
            capturedFrame,
            sceneUnderstanding,
            setCurrentScene
          );

          // Show error toast if scene analysis failed
          if (sceneResult.error) {
            setToast(sceneResult.error, 'error');
            // Continue anyway - don't block the conversation
          }
        }

        // Step 5: Build conversation context from all sources
        const combinedContext = buildConversationContext(
          backgroundContext,
          objectResult.context,
          objectRecognition.records
        );

        // Step 6: Send message to AI with context
        // Note: Small talk TTS has been stopped in the finally block above
        // This ensures no audio conflict between small talk and main AI response
        await sendMessage(inputText, {
          modelType: 'haiku',
          enableTTS: true,
          backgroundStory: combinedContext || undefined,
          sceneContext: sceneUnderstanding.currentScene,
        });

        // Note: AI status changes are managed by parent component's useEffect
      } catch (error) {
        console.error('[AIConversationFlow] Error:', error);
        setToast(
          error instanceof Error ? error.message : '对话处理失败',
          'error'
        );
      }
    },
    [
      sendMessage,
      sceneUnderstanding,
      objectRecognition,
      backgroundContext,
      addChatMessage,
      setCurrentScene,
      setToast,
      getCapturedFrame,
      generateMessageId,
    ]
  );

  return {
    startConversation,
  };
};
