/**
 * Conversation Context Builder
 *
 * This module provides utilities for building conversation context from multiple sources:
 * - Background story context
 * - Object recognition results
 * - Scene analysis data
 * - Recent object recognition records
 *
 * These functions were extracted from HomeScreen.tsx to improve modularity and testability.
 *
 * @module buildConversationContext
 */

import {
  detectObjectKeywords,
  detectVisualKeywords,
  formatObjectRecognitionForAI,
} from '../../capabilities/vision';
import type { BackgroundContext } from '../../utils/backgroundStory';
import type { ObjectRecognitionRecord } from '../../types/scene';

/**
 * Object recognition result for context building
 */
export interface ObjectRecognitionResult {
  triggered: boolean;
  context: string;
  error: string | null;
}

/**
 * Scene analysis result
 */
export interface SceneAnalysisResult {
  triggered: boolean;
  error: string | null;
}

/**
 * Build conversation context from multiple sources
 *
 * Combines background story, object recognition results, and recent records
 * into a unified context string for AI consumption.
 *
 * @param backgroundContext - Background story context (if available)
 * @param objectContext - Object recognition result context
 * @param objectRecognitionRecords - Recent object recognition records
 * @returns Combined context string for AI
 */
export function buildConversationContext(
  backgroundContext: BackgroundContext | null,
  objectContext: string | null,
  objectRecognitionRecords: ObjectRecognitionRecord[]
): string {
  let combinedContext = '';

  // 1. Add background story if available
  if (backgroundContext) {
    // Import formatStoryForAI inline to avoid circular dependency
    const { formatStoryForAI } = require('../../utils/backgroundStory');
    combinedContext += formatStoryForAI(backgroundContext);
  }

  // 2. Add object recognition context if triggered by keyword
  if (objectContext) {
    if (combinedContext) {
      combinedContext += '\n\n';
    }
    combinedContext += objectContext;
  } else {
    // 3. Check if there's a recent object recognition record (within 5 minutes)
    // This allows user to manually recognize an object, then ask AI about it
    if (objectRecognitionRecords.length > 0) {
      const latestRecord = objectRecognitionRecords[0]; // Already sorted newest first
      const recordAge = Date.now() - latestRecord.createdAt;
      const fiveMinutesInMs = 5 * 60 * 1000;

      if (recordAge < fiveMinutesInMs) {
        console.log(
          '[ConversationContext] 📦 Using recent object recognition as context:',
          {
            name: latestRecord.data.objectName,
            ageSeconds: Math.round(recordAge / 1000),
          }
        );

        if (combinedContext) {
          combinedContext += '\n\n';
        }
        combinedContext += '【最近识别的物品】\n';
        combinedContext += formatObjectRecognitionForAI(latestRecord.data);
      }
    }
  }

  return combinedContext;
}

/**
 * Handle object recognition keyword detection and execution
 *
 * Detects object recognition keywords in user input and triggers recognition
 * if a keyword is found and a camera frame is available.
 *
 * @param userText - User's input text
 * @param capturedFrame - Base64 encoded camera frame
 * @param objectRecognition - Object recognition API instance
 * @returns Object recognition result with context
 */
export async function handleObjectRecognition(
  userText: string,
  capturedFrame: string | null,
  objectRecognition: {
    recognizeObject: (
      frame: string,
      question: string
    ) => Promise<{ success: boolean; object: any; error?: string }>;
  }
): Promise<ObjectRecognitionResult> {
  // 1. Check for object recognition keywords
  const objectKeyword = detectObjectKeywords(userText);

  if (!objectKeyword) {
    return {
      triggered: false,
      context: '',
      error: null,
    };
  }

  console.log(
    `[ConversationContext] 🎯 Object recognition keyword detected: "${objectKeyword}"`
  );

  // 2. Check if we have a captured frame
  if (!capturedFrame) {
    console.log(
      '[ConversationContext] ⚠️ Object keyword detected but no image available'
    );
    return {
      triggered: true,
      context: '',
      error: null, // Not a critical error, just no image available
    };
  }

  // 3. Trigger object recognition
  try {
    console.log('[ConversationContext] 📸 Starting object recognition...');

    const recognitionResponse = await objectRecognition.recognizeObject(
      capturedFrame,
      userText // Pass user's original question
    );

    if (recognitionResponse.success) {
      // Format object recognition result as context
      const objectContext = formatObjectRecognitionForAI(
        recognitionResponse.object
      );

      console.log('[ConversationContext] ✅ Object recognition complete:', {
        name: recognitionResponse.object.objectName,
        category: recognitionResponse.object.category,
        contextLength: objectContext.length,
      });

      return {
        triggered: true,
        context: objectContext,
        error: null,
      };
    } else {
      console.error(
        '[ConversationContext] ❌ Object recognition failed:',
        recognitionResponse.error
      );
      return {
        triggered: true,
        context: '',
        error: recognitionResponse.error || '物品识别失败',
      };
    }
  } catch (error) {
    console.error('[ConversationContext] ❌ Object recognition error:', error);
    return {
      triggered: true,
      context: '',
      error:
        error instanceof Error
          ? `物品识别失败: ${error.message}`
          : '物品识别失败: 未知错误',
    };
  }
}

/**
 * Handle scene analysis keyword detection and execution
 *
 * Detects scene analysis keywords in user input and triggers analysis
 * if a keyword is found and a camera frame is available.
 *
 * @param userText - User's input text
 * @param capturedFrame - Base64 encoded camera frame
 * @param sceneUnderstanding - Scene understanding API instance
 * @param onSceneUpdate - Callback to update scene in store
 * @returns Scene analysis result
 */
export async function handleSceneAnalysis(
  userText: string,
  capturedFrame: string | null,
  sceneUnderstanding: {
    analyzeScene: (frame: string, question?: string) => Promise<void>;
    currentScene: any;
  },
  onSceneUpdate: (scene: any) => void
): Promise<SceneAnalysisResult> {
  // 1. Check for scene analysis keywords
  const detectedKeyword = detectVisualKeywords(userText);

  if (!detectedKeyword) {
    return {
      triggered: false,
      error: null,
    };
  }

  console.log(
    `[ConversationContext] 🎯 Visual keyword detected: "${detectedKeyword}"`
  );

  // 2. Check if we have a captured frame
  if (!capturedFrame) {
    console.log(
      '[ConversationContext] ⚠️ Visual keyword detected but no image available'
    );
    return {
      triggered: true,
      error: null, // Not a critical error, just no image available
    };
  }

  // 3. Trigger scene analysis
  try {
    console.log('[ConversationContext] 🔍 Starting scene analysis with caching...');

    // Use sceneUnderstanding.analyzeScene to ensure caching
    await sceneUnderstanding.analyzeScene(
      capturedFrame,
      userText // Pass user question for context
    );

    // Update userStore with the analyzed scene for AI context
    const analyzedScene = sceneUnderstanding.currentScene;
    if (analyzedScene) {
      onSceneUpdate(analyzedScene);
      console.log('[ConversationContext] 📝 Updated scene:', {
        location: analyzedScene.location,
        objects: analyzedScene.objects,
        timestamp: analyzedScene.timestamp,
      });
    } else {
      console.warn('[ConversationContext] ⚠️ No scene data returned from analysis');
    }

    console.log('[ConversationContext] ✅ Scene analysis complete and cached');

    return {
      triggered: true,
      error: null,
    };
  } catch (error) {
    console.error('[ConversationContext] ❌ Scene analysis error:', error);
    return {
      triggered: true,
      error:
        error instanceof Error
          ? `场景分析失败: ${error.message}`
          : '场景分析失败: 未知错误',
    };
  }
}
