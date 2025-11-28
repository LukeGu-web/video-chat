/**
 * Multi-Source Retriever - RAG多源检索器
 * 并行搜索多个数据源（聊天记录、物体识别、场景理解）
 */

import { useChatStore, ChatMessage } from '../../store/chatStore';
import { useObjectRecognitionStore } from '../../store/objectRecognitionStore';
import { useSceneStore } from '../../store/sceneStore';
import { QueryAnalysis } from './queryAnalyzer';
import { ObjectRecognitionRecord, SceneCacheEntry } from '../../types/scene';

// ============================================
// Types
// ============================================

export interface RetrievalResult {
  // Object recognition records
  objects: Array<{
    record: ObjectRecognitionRecord;
    relevance: number; // Relevance score 0-1
  }>;

  // Chat history messages
  conversations: Array<{
    message: ChatMessage;
    relevance: number;
  }>;

  // Scene understanding records
  scenes: Array<{
    scene: SceneCacheEntry;
    relevance: number;
  }>;

  // Retrieval metadata
  metadata: {
    totalFound: number;
    searchTimeMs: number;
    sources: string[];
  };
}

// ============================================
// Main Retrieval Function
// ============================================

/**
 * Retrieve relevant information from multiple data sources
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

  return {
    objects,
    conversations,
    scenes,
    metadata: {
      totalFound: objects.length + conversations.length + scenes.length,
      searchTimeMs,
      sources: ['objects', 'conversations', 'scenes'],
    },
  };
}

// ============================================
// Source-Specific Search Functions
// ============================================

/**
 * Search object recognition records
 */
async function searchObjects(
  analysis: QueryAnalysis
): Promise<RetrievalResult['objects']> {
  const store = useObjectRecognitionStore.getState();
  const records = store.records;

  const results: RetrievalResult['objects'] = [];

  for (const record of records) {
    let relevance = 0;

    // 1. Time matching (40% weight)
    if (analysis.timeReference?.range) {
      const recordTime = record.createdAt;
      const { start, end } = analysis.timeReference.range;
      if (recordTime >= start.getTime() && recordTime <= end.getTime()) {
        relevance += 0.4;
      }
    }

    // 2. Keyword matching (40% weight)
    const objectText = `${record.data.objectName} ${record.data.description} ${record.data.category}`.toLowerCase();
    const matchedKeywords = analysis.keywords.filter((keyword) =>
      objectText.includes(keyword.toLowerCase())
    );
    if (matchedKeywords.length > 0) {
      relevance += 0.4 * (matchedKeywords.length / analysis.keywords.length);
    }

    // 3. Entity type matching (20% weight)
    if (analysis.entities) {
      for (const entity of analysis.entities) {
        if (
          entity.type === 'book' &&
          record.data.category.toLowerCase().includes('书')
        ) {
          relevance += 0.2;
        } else if (
          entity.type === 'object' &&
          record.data.category.toLowerCase() === 'object'
        ) {
          relevance += 0.2;
        }
      }
    }

    // Only return results with relevance > 0.2
    if (relevance > 0.2) {
      results.push({ record, relevance });
    }
  }

  // Sort by relevance (descending)
  results.sort((a, b) => b.relevance - a.relevance);

  // Return top 5 most relevant results
  return results.slice(0, 5);
}

/**
 * Search chat history
 */
async function searchConversations(
  analysis: QueryAnalysis
): Promise<RetrievalResult['conversations']> {
  const store = useChatStore.getState();
  const messages = store.chatHistory;

  const results: RetrievalResult['conversations'] = [];

  for (const message of messages) {
    let relevance = 0;

    // 1. Time matching (30% weight)
    if (analysis.timeReference?.range) {
      const messageTime = message.timestamp;
      const { start, end } = analysis.timeReference.range;
      if (messageTime >= start.getTime() && messageTime <= end.getTime()) {
        relevance += 0.3;
      }
    }

    // 2. Keyword matching (50% weight)
    const messageText = message.content.toLowerCase();
    const matchedKeywords = analysis.keywords.filter((keyword) =>
      messageText.includes(keyword.toLowerCase())
    );
    if (matchedKeywords.length > 0) {
      relevance += 0.5 * (matchedKeywords.length / analysis.keywords.length);
    }

    // 3. Role weight (user messages have higher weight)
    if (message.role === 'user') {
      relevance *= 1.2;
    }

    if (relevance > 0.2) {
      results.push({ message, relevance });
    }
  }

  results.sort((a, b) => b.relevance - a.relevance);
  return results.slice(0, 5);
}

/**
 * Search scene understanding records
 */
async function searchScenes(
  analysis: QueryAnalysis
): Promise<RetrievalResult['scenes']> {
  const store = useSceneStore.getState();
  const scenes = store.cache;

  const results: RetrievalResult['scenes'] = [];

  for (const scene of scenes) {
    let relevance = 0;

    // 1. Time matching (50% weight)
    if (analysis.timeReference?.range) {
      const sceneTime = scene.cachedAt;
      const { start, end } = analysis.timeReference.range;
      if (sceneTime >= start.getTime() && sceneTime <= end.getTime()) {
        relevance += 0.5;
      }
    }

    // 2. Keyword matching (scene location and objects - 50% weight)
    const sceneText = `${scene.scene.location} ${scene.scene.objects.join(' ')}`.toLowerCase();
    const matchedKeywords = analysis.keywords.filter((keyword) =>
      sceneText.includes(keyword.toLowerCase())
    );
    if (matchedKeywords.length > 0) {
      relevance += 0.5 * (matchedKeywords.length / analysis.keywords.length);
    }

    if (relevance > 0.2) {
      results.push({ scene, relevance });
    }
  }

  results.sort((a, b) => b.relevance - a.relevance);
  return results.slice(0, 3);
}
