/**
 * SmartSentenceBuffer - Intelligent Sentence Filtering System
 * SMART Content Prioritization System - Phase 2
 *
 * Purpose: Filter AI responses in real-time during streaming,
 * keeping important sentences and skipping secondary information.
 *
 * Three-layer defense:
 * - Layer 1: AI generates content ordered by importance (System Prompt)
 * - Layer 2: SmartSentenceBuffer filters in real-time (this file)
 * - Layer 3: validateAndOptimizeResponse ensures final safety
 */

import type {
  ConversationType,
  LengthConfig,
  SentenceWithScore,
  BufferStats,
  SmartBufferOptions
} from '../types/smartBuffer';

export class SmartSentenceBuffer {
  private conversationType: ConversationType;
  private debug: boolean;

  // Sentence tracking
  private sentenceCount: number = 0;
  private totalLength: number = 0;
  private playedSentences: SentenceWithScore[] = [];
  private skippedSentences: SentenceWithScore[] = [];

  // Buffer for incomplete sentence
  private partialSentence: string = '';

  // Sentence boundary markers (Chinese punctuation)
  private readonly sentenceEndings = ['。', '！', '？', '~', '…', '呢', '哦', '啊', '呀'];

  constructor(options: SmartBufferOptions) {
    this.conversationType = options.conversationType;
    this.debug = options.debug || false;

    if (this.debug) {
      console.log(`[SmartBuffer] Initialized with type: ${this.conversationType}`);
    }
  }

  /**
   * Add a chunk of text and extract complete sentences
   * Returns array of sentences that should be played
   */
  public addChunk(chunk: string): string[] {
    this.partialSentence += chunk;
    const completeSentences = this.extractCompleteSentences();

    const sentencesToPlay: string[] = [];

    for (const sentence of completeSentences) {
      const trimmed = sentence.trim();
      if (!trimmed) continue;

      // Evaluate if this sentence should be played
      if (this.shouldPlay(trimmed)) {
        sentencesToPlay.push(trimmed);
        this.playedSentences.push({
          text: trimmed,
          importance: this.calculateImportance(trimmed),
          position: this.sentenceCount
        });
        this.totalLength += trimmed.length;
        this.sentenceCount++;

        if (this.debug) {
          console.log(`[SmartBuffer] ✅ Playing sentence ${this.sentenceCount}: "${trimmed}"`);
        }
      } else {
        this.skippedSentences.push({
          text: trimmed,
          importance: this.calculateImportance(trimmed),
          position: this.sentenceCount
        });
        this.sentenceCount++;

        if (this.debug) {
          console.log(`[SmartBuffer] ❌ Skipping sentence ${this.sentenceCount}: "${trimmed}"`);
        }
      }
    }

    return sentencesToPlay;
  }

  /**
   * Flush any remaining partial sentence
   */
  public flush(): string | null {
    if (!this.partialSentence.trim()) return null;

    const sentence = this.partialSentence.trim();
    this.partialSentence = '';

    // Evaluate final sentence
    if (this.shouldPlay(sentence)) {
      this.playedSentences.push({
        text: sentence,
        importance: this.calculateImportance(sentence),
        position: this.sentenceCount
      });
      this.totalLength += sentence.length;
      this.sentenceCount++;

      if (this.debug) {
        console.log(`[SmartBuffer] ✅ Flushing final sentence: "${sentence}"`);
      }

      return sentence;
    } else {
      this.skippedSentences.push({
        text: sentence,
        importance: this.calculateImportance(sentence),
        position: this.sentenceCount
      });
      this.sentenceCount++;

      if (this.debug) {
        console.log(`[SmartBuffer] ❌ Skipping final sentence: "${sentence}"`);
      }

      return null;
    }
  }

  /**
   * Get buffer statistics
   */
  public getStats(): BufferStats {
    const avgImportance = this.playedSentences.length > 0
      ? this.playedSentences.reduce((sum, s) => sum + s.importance, 0) / this.playedSentences.length
      : 0;

    return {
      totalSentences: this.sentenceCount,
      playedSentences: this.playedSentences.length,
      skippedSentences: this.skippedSentences.length,
      totalLength: this.totalLength,
      averageImportance: avgImportance
    };
  }

  /**
   * Reset buffer state
   */
  public reset(): void {
    this.sentenceCount = 0;
    this.totalLength = 0;
    this.playedSentences = [];
    this.skippedSentences = [];
    this.partialSentence = '';
  }

  /**
   * Extract complete sentences from partial buffer
   * Private helper method
   */
  private extractCompleteSentences(): string[] {
    const sentences: string[] = [];
    let currentSentence = '';

    for (let i = 0; i < this.partialSentence.length; i++) {
      const char = this.partialSentence[i];
      currentSentence += char;

      // Check if this is a sentence ending
      if (this.sentenceEndings.includes(char)) {
        sentences.push(currentSentence);
        currentSentence = '';
      }
    }

    // Update partial sentence with remaining incomplete text
    this.partialSentence = currentSentence;

    return sentences;
  }

  /**
   * Decide if a sentence should be played
   * Core filtering logic
   */
  private shouldPlay(sentence: string): boolean {
    const position = this.sentenceCount;
    const config = this.getLengthConfig();

    // Rule 1: First sentence ALWAYS plays (highest priority)
    if (position === 0) {
      if (this.debug) {
        console.log(`[SmartBuffer] Rule 1: First sentence - PLAY`);
      }
      return true;
    }

    // Rule 2: Check sentence limit (max sentences)
    if (position >= config.maxSentences) {
      if (this.debug) {
        console.log(`[SmartBuffer] Rule 2: Exceeded max sentences (${config.maxSentences}) - SKIP`);
      }
      return false;
    }

    // Rule 3: Check total length limit
    const wouldExceedLength = this.totalLength + sentence.length > config.maxCharacters;
    if (wouldExceedLength) {
      if (this.debug) {
        console.log(`[SmartBuffer] Rule 3: Would exceed max length (${config.maxCharacters}) - SKIP`);
      }
      return false;
    }

    // Rule 4: Check importance score
    const importance = this.calculateImportance(sentence);
    if (importance < config.importanceThreshold) {
      if (this.debug) {
        console.log(`[SmartBuffer] Rule 4: Low importance (${importance.toFixed(2)} < ${config.importanceThreshold}) - SKIP`);
      }
      return false;
    }

    // All checks passed - play this sentence
    if (this.debug) {
      console.log(`[SmartBuffer] All checks passed (importance: ${importance.toFixed(2)}) - PLAY`);
    }
    return true;
  }

  /**
   * Calculate sentence importance score (0-1)
   * Higher score = more important
   */
  private calculateImportance(sentence: string): number {
    let score = 0.5; // Base score

    // Rule 0: Pure filler words/interjections (CRITICAL - heavy penalty)
    // These are sentences with only interjections and no real content
    const pureFillerPatterns = [
      /^(嗯|啊|哦|诶|呀|嘛|哈)+[…~。！？]*$/,  // Pure interjections like "嗯…", "诶？"
      /^(让我想想|这个嘛|那个)[…~。！？]*$/,    // Pure filler phrases
      /^[…~。！？\s]+$/                          // Only punctuation
    ];

    if (pureFillerPatterns.some(pattern => pattern.test(sentence.trim()))) {
      if (this.debug) {
        console.log(`[SmartBuffer] 🚫 Pure filler detected: "${sentence}"`);
      }
      return 0.1; // Very low score for pure filler
    }

    // Check if sentence is too short (likely just filler)
    const contentLength = sentence.replace(/[~。！？…\s]/g, '').length;
    if (contentLength < 3) {
      if (this.debug) {
        console.log(`[SmartBuffer] ⚠️ Too short (${contentLength} chars): "${sentence}"`);
      }
      score -= 0.3; // Penalty for very short sentences
    }

    // Rule 1: Core information keywords (+0.2)
    const coreKeywords = ['是', '有', '在', '会', '能', '可以', '吃了', '做了', '去了', '看了', '想', '喜欢', '觉得'];
    if (coreKeywords.some(kw => sentence.includes(kw))) {
      score += 0.2;
    }

    // Rule 2: Sentence too long (-0.3)
    if (sentence.length > 25) {
      score -= 0.3;
    }

    // Rule 3: Supplement connectors (-0.2)
    // These indicate secondary information
    const supplementWords = ['然后', '还', '另外', '此外', '而且', '以及', '同时', '并且'];
    if (supplementWords.some(w => sentence.includes(w))) {
      score -= 0.2;
    }

    // Rule 4: Enumeration words (-0.25)
    const enumerationWords = ['比如', '例如', '包括', '像'];
    if (enumerationWords.some(w => sentence.includes(w))) {
      score -= 0.25;
    }

    // Rule 5: Explanation phrases (-0.2)
    const explanationPhrases = ['因为', '所以', '其实', '就是说', '也就是'];
    if (explanationPhrases.some(p => sentence.includes(p))) {
      score -= 0.2;
    }

    // Rule 6: Question/interaction words (+0.15)
    // Questions are often important for engagement
    const questionWords = ['吗', '呢', '吧', '？', '怎么', '什么', '为什么'];
    if (questionWords.some(w => sentence.includes(w))) {
      score += 0.15;
    }

    // Clamp score between 0 and 1
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Get length configuration for current conversation type
   */
  private getLengthConfig(): LengthConfig {
    switch (this.conversationType) {
      case 'simple':
        return {
          maxCharacters: 50,
          maxSentences: 1, // Only 1 sentence for simple
          importanceThreshold: 0.6
        };

      case 'normal':
        return {
          maxCharacters: 80,
          maxSentences: 2, // At most 2 sentences for normal
          importanceThreshold: 0.6
        };

      case 'detailed':
        return {
          maxCharacters: 150,
          maxSentences: 3,
          importanceThreshold: 0.5 // Lower threshold for detailed
        };

      case 'storytelling':
        return {
          maxCharacters: 250,
          maxSentences: 5,
          importanceThreshold: 0.4 // Lowest threshold for storytelling
        };

      default:
        return {
          maxCharacters: 80,
          maxSentences: 2,
          importanceThreshold: 0.6
        };
    }
  }
}

/**
 * Export types for use in other modules
 */
export type {
  ConversationType,
  LengthConfig,
  SentenceWithScore,
  BufferStats,
  SmartBufferOptions
};
