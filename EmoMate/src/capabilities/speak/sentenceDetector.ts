/**
 * Sentence Detector
 * Phase 2 Optimization: Real-time sentence detection for streaming TTS
 *
 * Features:
 * - Detects complete sentences from streaming text chunks
 * - Supports Chinese and English punctuation
 * - Triggers callbacks when sentences are complete
 * - Handles incomplete buffers gracefully
 */

export type SentenceCallback = (sentence: string) => void;

/**
 * Sentence buffer for detecting complete sentences from streaming text
 */
export class SentenceBuffer {
  private buffer = '';
  private onSentenceComplete: SentenceCallback;

  constructor(onSentenceComplete: SentenceCallback) {
    this.onSentenceComplete = onSentenceComplete;
  }

  /**
   * Add text chunk to buffer and detect complete sentences
   * @param chunk Text chunk from streaming API
   */
  add(chunk: string): void {
    this.buffer += chunk;
    this.detectSentences();
  }

  /**
   * Detect and extract complete sentences from buffer
   * Triggers callback for each complete sentence found
   */
  private detectSentences(): void {
    // Chinese sentence endings: 。 ！ ？
    // English sentence endings: . ! ?
    // Also consider newline as sentence boundary
    const sentenceEnds = /([。！？.!?]\s*|\n)/g;

    let lastIndex = 0;
    let match;

    while ((match = sentenceEnds.exec(this.buffer)) !== null) {
      const endIndex = match.index + match[0].length;
      const sentence = this.buffer.slice(lastIndex, endIndex).trim();

      if (sentence.length > 0 && this.isCompleteSentence(sentence)) {
        // Filter out standalone interjections (they should be part of next sentence)
        if (!this.isStandaloneInterjection(sentence)) {
          this.onSentenceComplete(sentence);
          lastIndex = endIndex;
        }
      }
    }

    // Remove extracted sentences from buffer
    if (lastIndex > 0) {
      this.buffer = this.buffer.slice(lastIndex);
      sentenceEnds.lastIndex = 0; // Reset regex
    }
  }

  /**
   * Check if text is a standalone interjection/filler
   * These should be combined with following content
   */
  private isStandaloneInterjection(text: string): boolean {
    // Common Chinese interjections and fillers
    const interjections = [
      '嗯', '呃', '啊', '哦', '诶', '欸', '呢', '吧', '哈',
      '嘿', '唔', '哎', '噢', '喔', '哇', '咦', '嘛', '喽',
      '嗯嗯', '哈哈', '嘿嘿', '欸嘿嘿', '诶嘿嘿'
    ];

    // Remove punctuation and whitespace for matching
    const cleanText = text.replace(/[。！？.!?\s~…]+/g, '');

    // Check if it's a pure interjection (<=3 chars and matches pattern)
    if (cleanText.length <= 3 && interjections.some(i => cleanText.includes(i))) {
      return true;
    }

    return false;
  }

  /**
   * Check if text is a complete sentence
   * Filters out incomplete fragments
   */
  private isCompleteSentence(text: string): boolean {
    // Must have at least 2 characters
    if (text.length < 2) return false;

    // Must end with punctuation
    const lastChar = text[text.length - 1];
    if (!/[。！？.!?]/.test(lastChar)) return false;

    return true;
  }

  /**
   * Force flush remaining buffer as final sentence
   * Called when stream ends
   * Enhanced: Ensures final sentence has proper punctuation
   */
  flush(): void {
    const remaining = this.buffer.trim();
    if (remaining.length > 0) {
      // Add punctuation if missing for more natural speech synthesis
      let finalSentence = remaining;
      const lastChar = remaining[remaining.length - 1];

      // If no ending punctuation, add one based on content
      if (!/[。！？.!?]/.test(lastChar)) {
        // Check if it's a question
        if (remaining.includes('吗') || remaining.includes('呢') ||
            remaining.includes('？') || remaining.includes('?') ||
            remaining.startsWith('怎么') || remaining.startsWith('为什么') ||
            remaining.startsWith('什么') || remaining.startsWith('哪里')) {
          finalSentence += '？';
        }
        // Check if it's an exclamation
        else if (remaining.includes('！') || remaining.includes('!') ||
                 remaining.includes('太') || remaining.includes('好棒') ||
                 remaining.includes('真')) {
          finalSentence += '！';
        }
        // Default: add period
        else {
          finalSentence += '。';
        }
        console.log(`[SentenceDetector] Added punctuation to final sentence: "${remaining}" → "${finalSentence}"`);
      }

      this.onSentenceComplete(finalSentence);
      this.buffer = '';
    }
  }

  /**
   * Clear buffer without triggering callbacks
   */
  clear(): void {
    this.buffer = '';
  }

  /**
   * Get current buffer content (for debugging)
   */
  getBuffer(): string {
    return this.buffer;
  }
}

/**
 * Parse Server-Sent Events (SSE) chunk from Claude API
 * @param chunk Raw SSE chunk text
 * @returns Extracted text content or null
 */
export function parseSSEChunk(chunk: string): string | null {
  const lines = chunk.split('\n');

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      try {
        const data = JSON.parse(line.slice(6));

        // Claude API streaming format
        if (data.type === 'content_block_delta' && data.delta?.text) {
          return data.delta.text;
        }
      } catch (e) {
        // Ignore parse errors for incomplete chunks
        continue;
      }
    }
  }

  return null;
}

/**
 * Create sentence buffer with callback
 * Convenience factory function
 */
export function createSentenceBuffer(
  onSentence: SentenceCallback
): SentenceBuffer {
  return new SentenceBuffer(onSentence);
}
