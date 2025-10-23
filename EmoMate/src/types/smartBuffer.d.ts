// SmartSentenceBuffer type definitions
// SMART Content Prioritization System - Phase 2

/**
 * Conversation type determines response length and sentence limits
 */
export type ConversationType = 'simple' | 'normal' | 'detailed' | 'storytelling';

/**
 * Configuration for conversation length limits
 */
export interface LengthConfig {
  maxCharacters: number; // Maximum total characters for the conversation
  maxSentences: number; // Maximum number of sentences to play
  importanceThreshold: number; // Minimum importance score to play (0-1)
}

/**
 * Sentence with importance score
 */
export interface SentenceWithScore {
  text: string;
  importance: number; // 0-1 score
  position: number; // Sentence position (0=first, 1=second, etc.)
}

/**
 * SmartSentenceBuffer statistics
 */
export interface BufferStats {
  totalSentences: number; // Total sentences detected
  playedSentences: number; // Sentences actually played
  skippedSentences: number; // Sentences skipped
  totalLength: number; // Total character length played
  averageImportance: number; // Average importance of played sentences
}

/**
 * SmartSentenceBuffer options
 */
export interface SmartBufferOptions {
  conversationType: ConversationType;
  debug?: boolean; // Enable debug logging
}
