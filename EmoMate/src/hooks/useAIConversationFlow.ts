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

import { useCallback } from 'react';
import type { ChatMessage } from '../store/chatStore';
import type { BackgroundContext } from '../utils/backgroundStory';
import type { ObjectRecognitionRecord } from '../types/scene';
import {
  buildConversationContext,
  handleObjectRecognition,
  handleSceneAnalysis,
} from '../utils/ai/buildConversationContext';

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
  } = config;

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
        const objectResult = await handleObjectRecognition(
          inputText,
          capturedFrame,
          objectRecognition
        );

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
