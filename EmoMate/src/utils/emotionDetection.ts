/**
 * Emotion Detection Utilities
 *
 * This module provides text-based emotion detection functionality.
 * Currently uses keyword matching for simple emotion classification.
 * Can be extended with ML-based emotion analysis in the future.
 *
 * @module emotionDetection
 */

/**
 * Emotion types supported by the system
 */
export type EmotionType = 'happy' | 'sad' | 'confused' | 'nervous' | 'neutral';

/**
 * Emotion keywords dictionary
 */
const EMOTION_KEYWORDS = {
  happy: ['开心', '高兴', '快乐', '哈哈', '嘿嘿', '棒', '太好了', '很开心', '真棒'],
  sad: ['难过', '伤心', '沮丧', '哭', '郁闷', '失落', '不开心', '痛苦', '悲伤'],
  confused: ['困惑', '不明白', '不懂', '？', '怎么', '为什么', '疑惑', '不解'],
  nervous: ['紧张', '害怕', '担心', '不安', '焦虑', '恐惧', '害羞', '压力'],
} as const;

/**
 * Detect user emotion from text content using keyword matching
 *
 * This function analyzes the text for emotion-related keywords and
 * returns the most likely emotion. It's a simple rule-based approach
 * that can be enhanced with ML in the future.
 *
 * @param text - The text to analyze
 * @returns The detected emotion type
 *
 * @example
 * ```ts
 * const emotion = detectUserEmotionFromText("我今天很开心");
 * console.log(emotion); // "happy"
 * ```
 */
export function detectUserEmotionFromText(text: string): EmotionType {
  const message = text.toLowerCase();

  // Check happy keywords
  if (EMOTION_KEYWORDS.happy.some((keyword) => message.includes(keyword))) {
    return 'happy';
  }

  // Check sad keywords
  if (EMOTION_KEYWORDS.sad.some((keyword) => message.includes(keyword))) {
    return 'sad';
  }

  // Check confused keywords
  if (EMOTION_KEYWORDS.confused.some((keyword) => message.includes(keyword))) {
    return 'confused';
  }

  // Check nervous keywords
  if (EMOTION_KEYWORDS.nervous.some((keyword) => message.includes(keyword))) {
    return 'nervous';
  }

  // Default to neutral
  return 'neutral';
}

/**
 * Get emotion confidence score (0-1)
 *
 * Returns how confident we are about the detected emotion based on
 * the number of matching keywords.
 *
 * @param text - The text to analyze
 * @param emotion - The detected emotion
 * @returns Confidence score between 0 and 1
 */
export function getEmotionConfidence(
  text: string,
  emotion: EmotionType
): number {
  if (emotion === 'neutral') {
    return 0.5; // Neutral is low confidence
  }

  const message = text.toLowerCase();
  const keywords = EMOTION_KEYWORDS[emotion] || [];
  const matchCount = keywords.filter((keyword) =>
    message.includes(keyword)
  ).length;

  // Normalize confidence based on match count
  return Math.min(matchCount * 0.3 + 0.4, 1.0);
}

/**
 * Enhanced emotion analysis result
 */
export interface EmotionAnalysisResult {
  emotion: EmotionType;
  confidence: number;
  keywords: string[];
}

/**
 * Analyze emotion with detailed results
 *
 * Provides more detailed emotion analysis including confidence score
 * and matched keywords.
 *
 * @param text - The text to analyze
 * @returns Detailed emotion analysis result
 */
export function analyzeEmotion(text: string): EmotionAnalysisResult {
  const emotion = detectUserEmotionFromText(text);
  const confidence = getEmotionConfidence(text, emotion);

  // Find matched keywords
  const message = text.toLowerCase();
  const allKeywords =
    emotion === 'neutral' ? [] : EMOTION_KEYWORDS[emotion] || [];
  const matchedKeywords = allKeywords.filter((keyword) =>
    message.includes(keyword)
  );

  return {
    emotion,
    confidence,
    keywords: matchedKeywords,
  };
}

/**
 * Check if text contains strong emotional indicators
 *
 * @param text - The text to analyze
 * @returns True if strong emotion is detected
 */
export function hasStrongEmotion(text: string): boolean {
  const result = analyzeEmotion(text);
  return result.confidence > 0.7 && result.emotion !== 'neutral';
}
