/**
 * Scene Keywords Detection Module
 * Handles detection of visual keywords and object recognition keywords in user text
 */

import { ObjectRecognitionData } from '../../../types/scene';

/**
 * Visual keywords that trigger scene analysis (Step 3.3)
 * These keywords must match exactly to avoid false triggers
 * E.g., "看" matches but "看起来" does not
 */
export const VISUAL_KEYWORDS = [
  '看',
  '看见',
  '看到',
  '这是什么',
  '周围',
  '这个',
  '那个',
  '什么东西',
  '哪里',
  '在哪',
  '附近',
  '旁边',
] as const;

/**
 * Detect visual keywords in user text (Step 3.3)
 * Uses precise matching to avoid false triggers
 * E.g., "看起来" won't trigger "看" keyword
 *
 * @param text - User input text
 * @returns The detected keyword or null
 */
export function detectVisualKeywords(text: string): string | null {
  if (!text || text.trim().length === 0) {
    return null;
  }

  const trimmedText = text.trim();

  // Check for exact phrase matches first (higher priority)
  const exactPhrases = ['这是什么', '什么东西', '在哪'];
  for (const phrase of exactPhrases) {
    if (trimmedText.includes(phrase)) {
      console.log(`[SceneKeywords] 🎯 Keyword detected: "${phrase}" in "${trimmedText}"`);
      return phrase;
    }
  }

  // Check for single character keywords with boundary detection
  const singleCharKeywords = ['看', '看见', '看到', '周围', '这个', '那个', '哪里', '附近', '旁边'];

  for (const keyword of singleCharKeywords) {
    // For single character keywords like "看", ensure it's not part of a longer word
    if (keyword.length === 1) {
      // Check if keyword appears as standalone character or at word boundary
      const regex = new RegExp(`(?:^|[^一-龥])${keyword}(?:[^一-龥起]|$)`);
      if (regex.test(trimmedText)) {
        console.log(`[SceneKeywords] 🎯 Keyword detected: "${keyword}" in "${trimmedText}"`);
        return keyword;
      }
    } else {
      // For multi-character keywords, simple includes check
      if (trimmedText.includes(keyword)) {
        console.log(`[SceneKeywords] 🎯 Keyword detected: "${keyword}" in "${trimmedText}"`);
        return keyword;
      }
    }
  }

  console.log(`[SceneKeywords] ⏭️ No visual keyword detected in "${trimmedText}"`);
  return null;
}

/**
 * Detect object recognition keywords in user text
 * These keywords trigger object recognition instead of scene understanding
 *
 * @param text - User input text
 * @returns The detected keyword or null
 */
export function detectObjectKeywords(text: string): string | null {
  if (!text || text.trim().length === 0) {
    return null;
  }

  const trimmedText = text.trim();

  // Object recognition phrases (specific to identifying objects)
  const objectPhrases = [
    '看这个',
    '看这个东西',
    '看看这个',
    '看看这',
    '帮我看看这个',
    '帮我看看这',
    '识别这个',
    '识别这',
    '这个是什么',
    '这是什么东西',
    '这什么',
    '这东西',
  ];

  for (const phrase of objectPhrases) {
    if (trimmedText.includes(phrase)) {
      console.log(`[SceneKeywords] 🎯 Object keyword detected: "${phrase}" in "${trimmedText}"`);
      return phrase;
    }
  }

  console.log(`[SceneKeywords] ⏭️ No object recognition keyword detected in "${trimmedText}"`);
  return null;
}

/**
 * Format object recognition data as AI context
 * Converts object recognition data into natural language for AI consumption
 *
 * @param objectData - Object recognition data
 * @returns Formatted context string for AI
 */
export function formatObjectRecognitionForAI(
  objectData: ObjectRecognitionData
): string {
  const parts: string[] = [];

  // Basic information
  parts.push(`【物品识别结果】`);
  parts.push(`物品名称: ${objectData.objectName}`);
  parts.push(`类别: ${objectData.category}`);
  parts.push(`描述: ${objectData.description}`);

  // Optional details
  if (objectData.brand) {
    parts.push(`品牌: ${objectData.brand}`);
  }

  if (objectData.model) {
    parts.push(`型号: ${objectData.model}`);
  }

  if (objectData.color) {
    parts.push(`颜色: ${objectData.color}`);
  }

  if (objectData.material) {
    parts.push(`材质: ${objectData.material}`);
  }

  if (objectData.priceRange) {
    parts.push(`价格范围: ${objectData.priceRange}`);
  }

  // Additional information
  if (objectData.additionalInfo && Object.keys(objectData.additionalInfo).length > 0) {
    parts.push(`其他信息:`);
    for (const [key, value] of Object.entries(objectData.additionalInfo)) {
      parts.push(`  - ${key}: ${value}`);
    }
  }

  // User's original question
  if (objectData.userPrompt) {
    parts.push(`用户提问: ${objectData.userPrompt}`);
  }

  // Confidence
  parts.push(`识别置信度: ${Math.round(objectData.confidence * 100)}%`);

  return parts.join('\n');
}
