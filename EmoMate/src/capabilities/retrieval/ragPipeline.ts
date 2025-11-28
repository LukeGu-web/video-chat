/**
 * RAG Pipeline - Complete Retrieval-Augmented Generation Flow
 * Integrates all RAG modules into a unified pipeline
 */

import { analyzeQuery, QueryAnalysis } from './queryAnalyzer';
import {
  retrieveFromMultipleSources,
  RetrievalResult,
} from './multiSourceRetriever';
import { buildRetrievalContext } from './contextBuilder';
import { debugLog } from '../../utils/debug';

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
}

export interface RAGOptions {
  // Enable/disable retrieval
  enableRetrieval?: boolean;

  // Maximum tokens for context
  maxContextTokens?: number;

  // Minimum relevance threshold
  minRelevanceThreshold?: number;
}

// ============================================
// Main RAG Pipeline Function
// ============================================

/**
 * Execute complete RAG pipeline
 *
 * @param userQuery - User's query text
 * @param options - RAG configuration options
 * @returns RAG result with enhanced context
 */
export async function executeRAG(
  userQuery: string,
  options?: RAGOptions
): Promise<RAGResult> {
  const {
    enableRetrieval = true,
    maxContextTokens = 500,
    minRelevanceThreshold = 0.3,
  } = options || {};

  // 1. Query Analysis
  const analysis = analyzeQuery(userQuery);

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
  const retrieval = await retrieveFromMultipleSources(analysis);

  debugLog('RAG', 'Retrieval complete', {
    totalFound: retrieval.metadata.totalFound,
    searchTimeMs: retrieval.metadata.searchTimeMs,
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

  // 5. Build context
  const context = buildRetrievalContext(filteredRetrieval, maxContextTokens);

  debugLog('RAG', 'Context built', {
    contextLength: context.length,
    hasContext: context.length > 0,
  });

  return {
    context,
    analysis,
    retrieval: filteredRetrieval,
    isRetrievalTriggered: true,
  };
}
