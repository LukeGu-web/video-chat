/**
 * Conversation Summarizer - RAG对话摘要生成器
 * Phase 3: Automatically summarize long conversations to reduce token usage
 */

import { ChatMessage } from '../../store/chatStore';
import { debugLog } from '../../utils/debug';

// ============================================
// Types
// ============================================

export interface ConversationSummary {
  id: string; // Unique ID for this summary
  startTimestamp: number; // First message timestamp
  endTimestamp: number; // Last message timestamp
  messageCount: number; // Number of messages summarized
  summary: string; // The generated summary text
  topics: string[]; // Key topics discussed
  createdAt: number; // When summary was created
  tokens: number; // Estimated token count of summary
}

export interface SummaryOptions {
  maxMessagesToSummarize?: number; // Maximum messages in one summary (default: 20)
  minMessagesForSummary?: number; // Minimum messages before creating summary (default: 10)
  summaryMaxTokens?: number; // Maximum tokens for summary (default: 200)
  includeEmotions?: boolean; // Include emotional tone in summary (default: true)
}

// ============================================
// Summary Generation (Without LLM)
// ============================================

/**
 * Generate conversation summary using rule-based approach
 * This avoids dependency on Claude API for summarization
 *
 * @param messages - Messages to summarize
 * @param options - Summary configuration
 * @returns Generated summary
 */
export function generateConversationSummary(
  messages: ChatMessage[],
  options?: SummaryOptions
): ConversationSummary {
  const {
    maxMessagesToSummarize = 20,
    minMessagesForSummary = 10,
    summaryMaxTokens = 200,
    includeEmotions = true,
  } = options || {};

  if (messages.length < minMessagesForSummary) {
    throw new Error(
      `Not enough messages to summarize (need at least ${minMessagesForSummary})`
    );
  }

  // Take most recent messages up to max
  const messagesToSummarize = messages.slice(-maxMessagesToSummarize);

  // Extract key information
  const topics = extractTopics(messagesToSummarize);
  const userMessages = messagesToSummarize.filter((m) => m.role === 'user');
  const assistantMessages = messagesToSummarize.filter(
    (m) => m.role === 'assistant'
  );

  // Build summary text
  const summaryParts: string[] = [];

  // Overview
  summaryParts.push(
    `对话包含${messagesToSummarize.length}条消息（用户${userMessages.length}条，AI${assistantMessages.length}条）`
  );

  // Topics
  if (topics.length > 0) {
    summaryParts.push(`讨论话题：${topics.slice(0, 5).join('、')}`);
  }

  // Extract key user questions
  const userQuestions = extractKeyQuestions(userMessages);
  if (userQuestions.length > 0) {
    summaryParts.push(
      `用户主要询问：${userQuestions.slice(0, 3).join('；')}`
    );
  }

  // Emotional tone (if enabled)
  if (includeEmotions) {
    const emotionalTone = analyzeEmotionalTone(messagesToSummarize);
    if (emotionalTone) {
      summaryParts.push(`情绪基调：${emotionalTone}`);
    }
  }

  const summaryText = summaryParts.join('。') + '。';

  const summary: ConversationSummary = {
    id: `summary_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    startTimestamp: messagesToSummarize[0].timestamp,
    endTimestamp: messagesToSummarize[messagesToSummarize.length - 1].timestamp,
    messageCount: messagesToSummarize.length,
    summary: summaryText,
    topics,
    createdAt: Date.now(),
    tokens: estimateTokens(summaryText),
  };

  debugLog('ConversationSummarizer', 'Summary generated', {
    messageCount: summary.messageCount,
    topics: summary.topics.length,
    summaryLength: summary.summary.length,
    tokens: summary.tokens,
  });

  return summary;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Extract key topics from conversation using keyword extraction
 */
function extractTopics(messages: ChatMessage[]): string[] {
  const allText = messages.map((m) => m.content).join(' ');

  // Common Chinese stop words
  const stopWords = new Set([
    '的',
    '了',
    '在',
    '是',
    '我',
    '你',
    '他',
    '她',
    '它',
    '这',
    '那',
    '和',
    '与',
    '及',
    '或',
    '也',
    '都',
    '吗',
    '呢',
    '吧',
    '啊',
    '呀',
    '嘛',
    '哦',
    '唉',
    '嗯',
    '哈',
    '哼',
  ]);

  // Extract words (simple tokenization)
  const words = allText
    .split(/[\s，。！？、；：""''（）【】《》\n]+/)
    .filter((word) => word.length >= 2) // At least 2 characters
    .filter((word) => !stopWords.has(word))
    .filter((word) => /[\u4e00-\u9fa5]/.test(word)); // Contains Chinese characters

  // Count word frequency
  const wordCounts = new Map<string, number>();
  words.forEach((word) => {
    wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
  });

  // Get top topics (words mentioned multiple times)
  const topics = Array.from(wordCounts.entries())
    .filter(([_, count]) => count >= 2) // Mentioned at least twice
    .sort((a, b) => b[1] - a[1]) // Sort by frequency
    .slice(0, 10) // Top 10
    .map(([word, _]) => word);

  return topics;
}

/**
 * Extract key questions from user messages
 */
function extractKeyQuestions(userMessages: ChatMessage[]): string[] {
  const questions: string[] = [];

  for (const message of userMessages) {
    const content = message.content;

    // Check if message contains question markers
    if (
      content.includes('？') ||
      content.includes('吗') ||
      content.includes('呢') ||
      content.includes('什么') ||
      content.includes('怎么') ||
      content.includes('为什么') ||
      content.includes('哪里') ||
      content.includes('谁')
    ) {
      // Extract first sentence or up to 30 characters
      const question = content.substring(0, 30);
      questions.push(question + (content.length > 30 ? '...' : ''));
    }
  }

  return questions;
}

/**
 * Analyze emotional tone of conversation
 */
function analyzeEmotionalTone(messages: ChatMessage[]): string | null {
  const allText = messages.map((m) => m.content).join(' ');

  // Simple emotion detection based on keywords
  const emotions = {
    positive: ['开心', '高兴', '快乐', '喜欢', '棒', '好', '太好了', '谢谢'],
    negative: ['难过', '伤心', '失望', '生气', '糟糕', '不好', '讨厌'],
    curious: ['为什么', '怎么', '什么', '哪里', '谁', '吗', '呢'],
    neutral: [],
  };

  const scores = {
    positive: 0,
    negative: 0,
    curious: 0,
  };

  // Count emotion keywords
  for (const [emotion, keywords] of Object.entries(emotions)) {
    if (emotion === 'neutral') continue;
    for (const keyword of keywords) {
      const count = (allText.match(new RegExp(keyword, 'g')) || []).length;
      scores[emotion as keyof typeof scores] += count;
    }
  }

  // Determine dominant emotion
  const maxScore = Math.max(scores.positive, scores.negative, scores.curious);
  if (maxScore === 0) return null;

  if (scores.positive === maxScore) return '积极';
  if (scores.negative === maxScore) return '消极';
  if (scores.curious === maxScore) return '好奇探索';

  return null;
}

/**
 * Estimate token count for summary text
 */
function estimateTokens(text: string): number {
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars * 1.5 + otherChars / 4);
}

// ============================================
// Summary Management
// ============================================

/**
 * Check if conversation should be summarized
 *
 * @param messageCount - Total message count
 * @param options - Summary options
 * @returns Whether to create summary
 */
export function shouldSummarizeConversation(
  messageCount: number,
  options?: SummaryOptions
): boolean {
  const { minMessagesForSummary = 10 } = options || {};
  return messageCount >= minMessagesForSummary;
}

/**
 * Create summary for sliding window of messages
 * Useful for maintaining conversation history without exceeding token limits
 *
 * @param allMessages - All conversation messages
 * @param windowSize - Size of sliding window (default: 20)
 * @param options - Summary options
 * @returns Array of summaries
 */
export function createSlidingWindowSummaries(
  allMessages: ChatMessage[],
  windowSize: number = 20,
  options?: SummaryOptions
): ConversationSummary[] {
  const summaries: ConversationSummary[] = [];

  // Process messages in windows
  for (let i = 0; i < allMessages.length; i += windowSize) {
    const windowMessages = allMessages.slice(i, i + windowSize);

    if (
      windowMessages.length >=
      (options?.minMessagesForSummary || 10)
    ) {
      try {
        const summary = generateConversationSummary(windowMessages, options);
        summaries.push(summary);
      } catch (error) {
        debugLog('ConversationSummarizer', 'Failed to create summary', error);
      }
    }
  }

  return summaries;
}

/**
 * Format summary for inclusion in RAG context
 */
export function formatSummaryForContext(summary: ConversationSummary): string {
  const timeAgo = formatRelativeTime(summary.startTimestamp);
  return `[对话摘要 - ${timeAgo}] ${summary.summary}`;
}

/**
 * Format relative time (simplified version)
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / (60 * 1000));
  const hours = Math.floor(diff / (60 * 60 * 1000));
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));

  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  return `${days}天前`;
}
