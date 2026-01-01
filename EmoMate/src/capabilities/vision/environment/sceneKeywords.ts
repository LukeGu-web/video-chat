/**
 * Scene Keywords Detection Module
 * Handles detection of visual keywords and object recognition keywords in user text
 */

import { ObjectRecognitionData } from '../../../types/scene';

/**
 * Visual keywords that trigger scene analysis (Step 3.3)
 * Supports both Chinese and English keywords
 * These keywords must match exactly to avoid false triggers
 * E.g., "看" matches but "看起来" does not
 */
export const VISUAL_KEYWORDS = {
  zh: [
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
  ],
  en: [
    'look',
    'see',
    'what is',
    "what's",
    'show me',
    'around',
    'nearby',
    'where',
    'where is',
    'surroundings',
    'environment',
  ],
} as const;

/**
 * Detect visual keywords in user text (Step 3.3)
 * Supports both Chinese and English keywords
 * Uses precise matching to avoid false triggers
 * E.g., "看起来" won't trigger "看" keyword, "looking" won't trigger "look"
 *
 * @param text - User input text
 * @returns The detected keyword or null
 */
export function detectVisualKeywords(text: string): string | null {
  if (!text || text.trim().length === 0) {
    return null;
  }

  const trimmedText = text.trim();
  const lowerText = trimmedText.toLowerCase();

  // Check Chinese keywords first
  // Exact phrase matches (higher priority)
  const chineseExactPhrases = ['这是什么', '什么东西', '在哪'];
  for (const phrase of chineseExactPhrases) {
    if (trimmedText.includes(phrase)) {
      console.log(`[SceneKeywords] 🎯 Keyword detected: "${phrase}" in "${trimmedText}"`);
      return phrase;
    }
  }

  // Single character Chinese keywords with boundary detection
  const chineseSingleCharKeywords = ['看', '看见', '看到', '周围', '这个', '那个', '哪里', '附近', '旁边'];
  for (const keyword of chineseSingleCharKeywords) {
    if (keyword.length === 1) {
      // For single character keywords like "看", ensure it's not part of a longer word
      const regex = new RegExp(`(?:^|[^一-龥])${keyword}(?:[^一-龥起]|$)`);
      if (regex.test(trimmedText)) {
        console.log(`[SceneKeywords] 🎯 Keyword detected: "${keyword}" in "${trimmedText}"`);
        return keyword;
      }
    } else {
      if (trimmedText.includes(keyword)) {
        console.log(`[SceneKeywords] 🎯 Keyword detected: "${keyword}" in "${trimmedText}"`);
        return keyword;
      }
    }
  }

  // Check English keywords
  // Multi-word phrases first (higher priority)
  const englishPhrases = ['what is', "what's", 'show me', 'where is'];
  for (const phrase of englishPhrases) {
    if (lowerText.includes(phrase)) {
      console.log(`[SceneKeywords] 🎯 Keyword detected: "${phrase}" in "${trimmedText}"`);
      return phrase;
    }
  }

  // Single word English keywords with word boundary detection
  const englishSingleWords = ['look', 'see', 'around', 'nearby', 'where', 'surroundings', 'environment'];
  for (const keyword of englishSingleWords) {
    // Use word boundary regex to avoid matching "looking", "seen", etc.
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(lowerText)) {
      console.log(`[SceneKeywords] 🎯 Keyword detected: "${keyword}" in "${trimmedText}"`);
      return keyword;
    }
  }

  console.log(`[SceneKeywords] ⏭️ No visual keyword detected in "${trimmedText}"`);
  return null;
}

/**
 * Detect object recognition keywords in user text
 * Supports both Chinese and English keywords
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
  const lowerText = trimmedText.toLowerCase();

  // Chinese object recognition phrases (specific to identifying objects)
  // Note: Order matters - check longer phrases first to avoid partial matching
  const chineseObjectPhrases = [
    '看这个东西',
    '帮我看看这个',
    '帮我看看这',
    '看这个',
    '看看这个',
    '看看这',
    '识别这个',
    '识别这',
    '这是什么东西',
    '这个是什么',
    '这是什么',  // Added: common question for object recognition
    '这什么',
    '这东西',
    '那是什么',  // Added: "what is that"
    '那个是什么',  // Added: "what is that one"
  ];

  for (const phrase of chineseObjectPhrases) {
    if (trimmedText.includes(phrase)) {
      console.log(`[SceneKeywords] 🎯 Object keyword detected: "${phrase}" in "${trimmedText}"`);
      return phrase;
    }
  }

  // English object recognition phrases
  const englishObjectPhrases = [
    'what is this',
    "what's this",
    'what is that',
    "what's that",
    'identify this',
    'identify that',
    'recognize this',
    'recognize that',
    'look at this',
    'look at that',
    'this is',
    'that is',
  ];

  for (const phrase of englishObjectPhrases) {
    if (lowerText.includes(phrase)) {
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
 * Supports both Chinese and English output
 *
 * @param objectData - Object recognition data
 * @param language - Language for formatting ('zh' or 'en')
 * @returns Formatted context string for AI
 */
export function formatObjectRecognitionForAI(
  objectData: ObjectRecognitionData,
  language: 'zh' | 'en' = 'zh'
): string {
  const parts: string[] = [];

  if (language === 'en') {
    // English format
    parts.push(`【Object Recognition Result】`);
    parts.push(`Object: ${objectData.objectName}`);
    parts.push(`Category: ${objectData.category}`);
    parts.push(`Description: ${objectData.description}`);

    if (objectData.brand) {
      parts.push(`Brand: ${objectData.brand}`);
    }

    if (objectData.model) {
      parts.push(`Model: ${objectData.model}`);
    }

    if (objectData.color) {
      parts.push(`Color: ${objectData.color}`);
    }

    if (objectData.material) {
      parts.push(`Material: ${objectData.material}`);
    }

    if (objectData.priceRange) {
      parts.push(`Price Range: ${objectData.priceRange}`);
    }

    if (objectData.additionalInfo && Object.keys(objectData.additionalInfo).length > 0) {
      parts.push(`Additional Info:`);
      for (const [key, value] of Object.entries(objectData.additionalInfo)) {
        parts.push(`  - ${key}: ${value}`);
      }
    }

    if (objectData.userPrompt) {
      parts.push(`User Question: ${objectData.userPrompt}`);
    }

    parts.push(`Confidence: ${Math.round(objectData.confidence * 100)}%`);
  } else {
    // Chinese format (original)
    parts.push(`【物品识别结果】`);
    parts.push(`物品名称: ${objectData.objectName}`);
    parts.push(`类别: ${objectData.category}`);
    parts.push(`描述: ${objectData.description}`);

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

    if (objectData.additionalInfo && Object.keys(objectData.additionalInfo).length > 0) {
      parts.push(`其他信息:`);
      for (const [key, value] of Object.entries(objectData.additionalInfo)) {
        parts.push(`  - ${key}: ${value}`);
      }
    }

    if (objectData.userPrompt) {
      parts.push(`用户提问: ${objectData.userPrompt}`);
    }

    parts.push(`识别置信度: ${Math.round(objectData.confidence * 100)}%`);
  }

  return parts.join('\n');
}
