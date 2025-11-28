/**
 * Multi-Source Retriever - RAG多源检索器
 * 并行搜索多个数据源（聊天记录、物体识别、场景理解）
 * Phase 2: Enhanced with optimized relevance scoring and time decay
 */

import { useChatStore, ChatMessage } from '../../store/chatStore';
import { useObjectRecognitionStore } from '../../store/objectRecognitionStore';
import { useSceneStore } from '../../store/sceneStore';
import { QueryAnalysis } from './queryAnalyzer';
import { ObjectRecognitionRecord, SceneCacheEntry } from '../../types/scene';
import {
  calculateRelevanceScore,
  DEFAULT_WEIGHTS,
  type RelevanceScoreBreakdown,
} from './relevanceScoring';

// ============================================
// Types
// ============================================

export interface RetrievalResult {
  // Object recognition records
  objects: Array<{
    record: ObjectRecognitionRecord;
    relevance: number; // Relevance score 0-1
    scoreBreakdown?: RelevanceScoreBreakdown; // Phase 2: Detailed score breakdown
  }>;

  // Chat history messages
  conversations: Array<{
    message: ChatMessage;
    relevance: number;
    scoreBreakdown?: RelevanceScoreBreakdown; // Phase 2: Detailed score breakdown
  }>;

  // Scene understanding records
  scenes: Array<{
    scene: SceneCacheEntry;
    relevance: number;
    scoreBreakdown?: RelevanceScoreBreakdown; // Phase 2: Detailed score breakdown
  }>;

  // Retrieval metadata
  metadata: {
    totalFound: number;
    searchTimeMs: number;
    sources: string[];
    averageRelevance?: number; // Phase 2: Average relevance score
  };
}

// ============================================
// Main Retrieval Function
// ============================================

/**
 * Retrieve relevant information from multiple data sources
 * Phase 2: Enhanced with average relevance calculation
 */
export async function retrieveFromMultipleSources(
  analysis: QueryAnalysis
): Promise<RetrievalResult> {
  const startTime = Date.now();

  // Search all data sources in parallel
  const [objects, conversations, scenes] = await Promise.all([
    searchObjects(analysis),
    searchConversations(analysis),
    searchScenes(analysis),
  ]);

  const searchTimeMs = Date.now() - startTime;

  // Calculate average relevance
  const allRelevanceScores = [
    ...objects.map((o) => o.relevance),
    ...conversations.map((c) => c.relevance),
    ...scenes.map((s) => s.relevance),
  ];

  const averageRelevance =
    allRelevanceScores.length > 0
      ? allRelevanceScores.reduce((sum, score) => sum + score, 0) /
        allRelevanceScores.length
      : 0;

  return {
    objects,
    conversations,
    scenes,
    metadata: {
      totalFound: objects.length + conversations.length + scenes.length,
      searchTimeMs,
      sources: ['objects', 'conversations', 'scenes'],
      averageRelevance, // Phase 2: Include average relevance
    },
  };
}

// ============================================
// Source-Specific Search Functions
// ============================================

/**
 * Search object recognition records
 * Phase 2: Using optimized relevance scoring with time decay
 */
async function searchObjects(
  analysis: QueryAnalysis
): Promise<RetrievalResult['objects']> {
  const store = useObjectRecognitionStore.getState();
  const records = store.records;

  const results: RetrievalResult['objects'] = [];

  for (const record of records) {
    // Construct searchable text
    const objectText = `${record.data.objectName} ${record.data.description} ${record.data.category}`;

    // Use optimized scoring algorithm
    const scoreBreakdown = calculateRelevanceScore({
      itemTimestamp: record.createdAt,
      itemText: objectText,
      itemEntityType: record.data.category,
      queryAnalysis: analysis,
      weights: DEFAULT_WEIGHTS.objects,
    });

    // Only return results with relevance > threshold
    if (scoreBreakdown.totalScore > 0.2) {
      results.push({
        record,
        relevance: scoreBreakdown.totalScore,
        scoreBreakdown, // Include breakdown for debugging
      });
    }
  }

  // Sort by relevance (descending)
  results.sort((a, b) => b.relevance - a.relevance);

  // Return top 5 most relevant results
  return results.slice(0, 5);
}

/**
 * Search chat history
 * Phase 2: Using optimized relevance scoring with time decay
 */
async function searchConversations(
  analysis: QueryAnalysis
): Promise<RetrievalResult['conversations']> {
  const store = useChatStore.getState();
  const messages = store.chatHistory;

  const results: RetrievalResult['conversations'] = [];

  for (const message of messages) {
    // Use optimized scoring algorithm
    const scoreBreakdown = calculateRelevanceScore({
      itemTimestamp: message.timestamp,
      itemText: message.content,
      itemEntityType: undefined, // Conversations don't have entity types
      queryAnalysis: analysis,
      weights: DEFAULT_WEIGHTS.conversations,
    });

    // Apply role weight boost (user messages are more important)
    let finalScore = scoreBreakdown.totalScore;
    if (message.role === 'user') {
      finalScore *= 1.2; // 20% boost for user messages
      finalScore = Math.min(finalScore, 1.0); // Clamp to 1.0
    }

    // Only return results with relevance > threshold
    if (finalScore > 0.2) {
      results.push({
        message,
        relevance: finalScore,
        scoreBreakdown: {
          ...scoreBreakdown,
          totalScore: finalScore,
        },
      });
    }
  }

  results.sort((a, b) => b.relevance - a.relevance);
  return results.slice(0, 5);
}

/**
 * Search scene understanding records
 * Phase 2: Using optimized relevance scoring with time decay
 */
async function searchScenes(
  analysis: QueryAnalysis
): Promise<RetrievalResult['scenes']> {
  const store = useSceneStore.getState();
  const scenes = store.cache;

  const results: RetrievalResult['scenes'] = [];

  for (const scene of scenes) {
    // Construct searchable text
    const sceneText = `${scene.scene.location} ${scene.scene.objects.join(' ')}`;

    // Use optimized scoring algorithm
    const scoreBreakdown = calculateRelevanceScore({
      itemTimestamp: scene.cachedAt,
      itemText: sceneText,
      itemEntityType: scene.scene.location, // Use location as entity type
      queryAnalysis: analysis,
      weights: DEFAULT_WEIGHTS.scenes,
    });

    // Only return results with relevance > threshold
    if (scoreBreakdown.totalScore > 0.2) {
      results.push({
        scene,
        relevance: scoreBreakdown.totalScore,
        scoreBreakdown,
      });
    }
  }

  results.sort((a, b) => b.relevance - a.relevance);
  return results.slice(0, 3);
}
