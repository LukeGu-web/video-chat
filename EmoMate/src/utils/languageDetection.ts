/**
 * Language Detection Utility
 * Detects whether user input is in Chinese or English
 */

export type SupportedLanguage = 'zh' | 'en';

/**
 * Detects the language of the input text
 * Rules:
 * - If text contains any Chinese characters (including Chinese punctuation), return 'zh'
 * - Otherwise, return 'en'
 *
 * @param text - The input text to analyze
 * @returns 'zh' if Chinese is detected, 'en' otherwise
 *
 * @example
 * detectLanguage("Hello") // 'en'
 * detectLanguage("你好") // 'zh'
 * detectLanguage("hello 你好") // 'zh' (mixed input defaults to Chinese)
 * detectLanguage("look at this") // 'en'
 */
export function detectLanguage(text: string): SupportedLanguage {
  if (!text || text.trim().length === 0) {
    return 'zh'; // Default to Chinese for empty input
  }

  // Chinese character ranges:
  // \u4e00-\u9fa5: CJK Unified Ideographs (common Chinese characters)
  // \u3000-\u303f: CJK Symbols and Punctuation
  // \uff00-\uffef: Halfwidth and Fullwidth Forms (including Chinese punctuation)
  const chinesePattern = /[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/;

  const hasChinese = chinesePattern.test(text);

  return hasChinese ? 'zh' : 'en';
}

/**
 * Checks if the text is purely in English (no Chinese characters)
 * @param text - The input text to check
 * @returns true if text contains no Chinese characters
 */
export function isEnglishOnly(text: string): boolean {
  return detectLanguage(text) === 'en';
}

/**
 * Checks if the text contains Chinese characters
 * @param text - The input text to check
 * @returns true if text contains Chinese characters
 */
export function hasChinese(text: string): boolean {
  return detectLanguage(text) === 'zh';
}
