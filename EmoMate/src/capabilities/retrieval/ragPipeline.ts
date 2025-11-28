/**
 * RAG Pipeline - Complete Retrieval-Augmented Generation Flow
 * Integrates all RAG modules into a unified pipeline
 * Phase 3: Enhanced with conversation summarization support
 */

import { analyzeQuery, QueryAnalysis } from './queryAnalyzer';
import {
  retrieveFromMultipleSources,
  RetrievalResult,
} from './multiSourceRetriever';
import { buildRetrievalContext, ContextBuildOptions } from './contextBuilder';
import { debugLog } from '../../utils/debug';
import {
  recordRAGPerformance,
  generatePerformanceReport,
  logPerformanceReport,
  type RAGPerformanceMetrics,
} from './performanceMonitor';
import {
  shouldSummarizeConversation,
  generateConversationSummary,
  formatSummaryForContext,
  type ConversationSummary,
  type SummaryOptions,
} from './conversationSummarizer';
import { useChatStore } from '../../store/chatStore';

// ============================================
// Types
// ============================================

export interface RAGResult {
  // Retrieval-enhanced context for AI prompt
  context: string;

  // Query analysis result
  analysis: QueryAnalysis;

  // Retrieval results
  retrieval: RetrievalResult;

  // Whether retrieval was triggered
  isRetrievalTriggered: boolean;

  // Phase 2: Performance metrics
  performance?: RAGPerformanceMetrics;

  // Phase 3: Conversation summaries
  summaries?: ConversationSummary[];
}

export interface RAGOptions {
  // Enable/disable retrieval
  enableRetrieval?: boolean;

  // Maximum tokens for context
  maxContextTokens?: number;

  // Minimum relevance threshold
  minRelevanceThreshold?: number;

  // Phase 2: Context build options
  contextOptions?: ContextBuildOptions;

  // Phase 2: Performance monitoring
  enablePerformanceMonitoring?: boolean;
  logPerformanceReport?: boolean;

  // Phase 3: Conversation summarization
  enableConversationSummaries?: boolean;
  summaryOptions?: SummaryOptions;
}

// ============================================
// Main RAG Pipeline Function
// ============================================

/**
 * Execute complete RAG pipeline
 * Phase 3: Enhanced with conversation summarization support
 *
 * @param userQuery - User's query text
 * @param options - RAG configuration options
 * @returns RAG result with enhanced context and performance metrics
 */
export async function executeRAG(
  userQuery: string,
  options?: RAGOptions
): Promise<RAGResult> {
  const startTime = Date.now();

  const {
    enableRetrieval = true,
    maxContextTokens = 500,
    minRelevanceThreshold = 0.3,
    contextOptions,
    enablePerformanceMonitoring = true,
    logPerformanceReport: shouldLogReport = false,
    enableConversationSummaries = false,
    summaryOptions,
  } = options || {};

  // 1. Query Analysis
  const queryAnalysisStart = Date.now();
  const analysis = analyzeQuery(userQuery);
  const queryAnalysisTimeMs = Date.now() - queryAnalysisStart;

  debugLog('RAG', 'Query analysis', {
    intent: analysis.intent,
    keywords: analysis.keywords,
    timeReference: analysis.timeReference?.value,
  });

  // 2. Determine if retrieval is needed
  const shouldRetrieve =
    enableRetrieval &&
    (analysis.intent === 'recall' || analysis.keywords.length > 0);

  if (!shouldRetrieve) {
    debugLog('RAG', 'Retrieval not triggered', {
      intent: analysis.intent,
      keywordCount: analysis.keywords.length,
    });

    return {
      context: '',
      analysis,
      retrieval: {
        objects: [],
        conversations: [],
        scenes: [],
        metadata: { totalFound: 0, searchTimeMs: 0, sources: [] },
      },
      isRetrievalTriggered: false,
    };
  }

  // 3. Multi-source retrieval
  const retrievalStart = Date.now();
  const retrieval = await retrieveFromMultipleSources(analysis);
  const retrievalTimeMs = Date.now() - retrievalStart;

  debugLog('RAG', 'Retrieval complete', {
    totalFound: retrieval.metadata.totalFound,
    searchTimeMs: retrieval.metadata.searchTimeMs,
    avgRelevance: retrieval.metadata.averageRelevance,
    objects: retrieval.objects.length,
    conversations: retrieval.conversations.length,
    scenes: retrieval.scenes.length,
  });

  // 4. Filter low-relevance results
  const filteredRetrieval: RetrievalResult = {
    objects: retrieval.objects.filter(
      (o) => o.relevance >= minRelevanceThreshold
    ),
    conversations: retrieval.conversations.filter(
      (c) => c.relevance >= minRelevanceThreshold
    ),
    scenes: retrieval.scenes.filter((s) => s.relevance >= minRelevanceThreshold),
    metadata: retrieval.metadata,
  };

  const totalFiltered =
    filteredRetrieval.objects.length +
    filteredRetrieval.conversations.length +
    filteredRetrieval.scenes.length;

  debugLog('RAG', 'After filtering', {
    totalFiltered,
    threshold: minRelevanceThreshold,
  });

  // 4.5. Generate conversation summaries (Phase 3)
  let summaries: ConversationSummary[] | undefined;
  let summaryContext = '';

  if (enableConversationSummaries) {
    const chatHistory = useChatStore.getState().chatHistory;

    if (shouldSummarizeConversation(chatHistory.length, summaryOptions)) {
      try {
        const summary = generateConversationSummary(chatHistory, summaryOptions);
        summaries = [summary];
        summaryContext = formatSummaryForContext(summary) + '\n\n';

        debugLog('RAG', 'Conversation summary generated', {
          messageCount: summary.messageCount,
          topics: summary.topics.length,
          summaryLength: summary.summary.length,
          tokens: summary.tokens,
        });
      } catch (error) {
        debugLog('RAG', 'Failed to generate summary', error);
      }
    }
  }

  // 5. Build context
  const contextBuildStart = Date.now();
  const retrievalContext = buildRetrievalContext(filteredRetrieval, {
    maxTokens: maxContextTokens,
    ...contextOptions,
  });

  // Combine summary context with retrieval context
  const context = summaryContext + retrievalContext;
  const contextBuildTimeMs = Date.now() - contextBuildStart;

  debugLog('RAG', 'Context built', {
    contextLength: context.length,
    hasContext: context.length > 0,
  });

  const totalTimeMs = Date.now() - startTime;

  const result: RAGResult = {
    context,
    analysis,
    retrieval: filteredRetrieval,
    isRetrievalTriggered: true,
    summaries,
  };

  // 6. Performance monitoring
  if (enablePerformanceMonitoring) {
    const performanceMetrics = recordRAGPerformance(result, {
      queryAnalysisTimeMs,
      retrievalTimeMs,
      contextBuildTimeMs,
      totalTimeMs,
    });

    result.performance = performanceMetrics;

    if (shouldLogReport) {
      const report = generatePerformanceReport(performanceMetrics);
      logPerformanceReport(report);
    }
  }

  return result;
}
