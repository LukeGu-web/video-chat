/**
 * Object Recognition Helper
 * Helper functions to integrate object recognition with AI conversation
 * Uses existing useChatAI and useAIStatus for unified state management
 */

import { ObjectRecognitionData } from '../types/scene';
import {
  generateObjectAnnouncement,
  generateErrorWithRetry,
  RecognitionErrorType,
} from './objectRecognitionAnnouncer';
import { SmallTalkManager, createSmallTalkManager } from './smallTalk';

/**
 * Create object recognition prompt for Claude AI
 * Generates a natural conversation prompt based on recognition result
 */
export function createRecognitionPrompt(
  objectData: ObjectRecognitionData,
  isSuccess: boolean,
  error?: string
): string {
  if (!isSuccess) {
    // Error case - let AI generate comforting response
    return `我刚才尝试识别一个物品，但是没有成功。${error || '识别失败了'}`;
  }

  // Success case - let AI announce the result naturally
  const announcement = generateObjectAnnouncement(objectData);

  // Return as a statement that AI can respond to
  // This way AI will speak the announcement in兰兰's style
  return announcement;
}

/**
 * Create error prompt with retry suggestion
 */
export function createErrorPrompt(errorType: RecognitionErrorType): string {
  return generateErrorWithRetry(errorType);
}

/**
 * Determine if recognition confidence is acceptable
 */
export function isConfidenceAcceptable(
  confidence: number,
  threshold: number = 0.5
): boolean {
  return confidence >= threshold;
}

/**
 * Create small talk manager for TTS playback
 * This is for direct TTS playback without going through Claude API
 */
export function createRecognitionSmallTalkManager(
  speakFunction: (text: string) => Promise<void>,
  stopFunction: () => void
): SmallTalkManager {
  return createSmallTalkManager(speakFunction, stopFunction);
}
