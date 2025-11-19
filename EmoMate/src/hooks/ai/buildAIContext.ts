/**
 * AI Context Builder
 *
 * This module provides unified functions for building AI context and API configurations.
 * It eliminates 72 lines of duplicate code from useChatAI.ts by centralizing:
 * - Scene context processing and freshness checking
 * - API request configuration building
 * - System message construction
 *
 * @module buildAIContext
 */

import {
  CLAUDE_API_CONFIG,
  getClaudeApiKey,
  AI_ERROR_MESSAGES,
  buildSystemPrompt,
  getResponseLengthConfig,
} from '../../constants/ai';
import { buildScenePrompt, isSceneDataFresh } from '../../capabilities/vision/environment/buildScenePrompt';
import { SceneData } from '../../types/scene';
import { ChatMessage, ChatAIConfig } from '../useChatAI';

/**
 * Scene metadata returned by buildSceneContext
 */
export interface SceneMetadata {
  source: 'config' | 'store';
  hasScene: boolean;
  isFresh: boolean;
  location: string | null;
  objectsCount: number;
  timestamp: number | null;
  ageMinutes: number | null;
}

/**
 * Scene context result
 */
export interface SceneContextResult {
  scenePrompt: string;
  contextPrompt: string;
  metadata: SceneMetadata;
}

/**
 * Build scene context with freshness checking and logging
 *
 * This function unifies the scene context building logic that was duplicated
 * in both callClaudeAPI and callClaudeAPIStreaming functions.
 *
 * @param sceneContext - Scene data from config (prioritized)
 * @param currentScene - Scene data from store (fallback)
 * @param freshnessMinutes - Maximum age in minutes for scene to be considered fresh
 * @returns Scene context result with prompt and metadata
 */
export function buildSceneContext(
  sceneContext: SceneData | null | undefined,
  currentScene: SceneData | null,
  freshnessMinutes: number = 30
): SceneContextResult {
  // Step 1: Prioritize sceneContext from config to avoid state update delay
  const sceneToUse = sceneContext !== undefined ? sceneContext : currentScene;
  const isFresh = isSceneDataFresh(sceneToUse, freshnessMinutes);

  // Step 2: Build metadata for debugging
  const metadata: SceneMetadata = {
    source: sceneContext !== undefined ? 'config' : 'store',
    hasScene: !!sceneToUse,
    isFresh,
    location: sceneToUse?.location || null,
    objectsCount: sceneToUse?.objects?.length || 0,
    timestamp: sceneToUse?.timestamp || null,
    ageMinutes: sceneToUse?.timestamp ? (Date.now() - sceneToUse.timestamp) / 60000 : null,
  };

  // Step 3: Log scene data check
  console.log('[ChatAI] 🔍 Scene data check:', {
    source: metadata.source,
    hasScene: metadata.hasScene,
    isFresh: metadata.isFresh,
    location: metadata.location,
    objectsCount: metadata.objectsCount,
    timestamp: metadata.timestamp,
    ageMinutes: metadata.ageMinutes,
  });

  // Step 4: Build scene prompt if fresh
  const scenePrompt = isFresh ? buildScenePrompt(sceneToUse, true, 5) : '';

  // Step 5: Log prompt generation result
  if (scenePrompt) {
    console.log('[ChatAI] ✅ Scene prompt generated:', scenePrompt.substring(0, 200) + '...');
  } else {
    console.log('[ChatAI] ⚠️ No scene prompt (scene not fresh or missing)');
  }

  // Step 6: Use scene prompt as context
  const contextPrompt = scenePrompt;

  console.log('[ChatAI] 📝 Context prompt length:', contextPrompt.length);

  return {
    scenePrompt,
    contextPrompt,
    metadata,
  };
}

/**
 * API request configuration result
 */
export interface APIRequestConfig {
  model: string;
  systemMessage: string;
  contextMessages: Array<{ role: string; content: string }>;
  lengthConfig: {
    maxTokens: number;
    targetCharacters: number;
  };
  apiKey: string;
}

/**
 * Build unified API request configuration
 *
 * This function unifies the API configuration building logic that was duplicated
 * in both callClaudeAPI and callClaudeAPIStreaming functions.
 *
 * @param messages - Chat message history
 * @param config - Chat AI configuration
 * @param conversationType - Type of conversation (simple, normal, detailed, storytelling)
 * @param currentPersonality - Current personality prompt
 * @param currentScene - Current scene data from store
 * @returns Complete API request configuration
 * @throws Error if API key is missing
 */
export function buildAPIRequestConfig(
  messages: ChatMessage[],
  config: ChatAIConfig,
  conversationType: 'simple' | 'normal' | 'detailed' | 'storytelling',
  currentPersonality: string,
  currentScene: SceneData | null
): APIRequestConfig {
  // Step 1: Get and validate API key
  const apiKey = config.apiKey || getClaudeApiKey();
  if (!apiKey) {
    throw new Error(AI_ERROR_MESSAGES.API_KEY_MISSING);
  }

  // Step 2: Select model
  const model = config.modelType
    ? CLAUDE_API_CONFIG.models[config.modelType]
    : CLAUDE_API_CONFIG.models[CLAUDE_API_CONFIG.defaultModel];

  // Step 3: Get dynamic token configuration
  const lengthConfig = getResponseLengthConfig(conversationType);

  // Step 4: Get personality text
  const personalityText = config.personality || currentPersonality;

  // Step 5: Build scene context
  const { contextPrompt } = buildSceneContext(
    config.sceneContext,
    currentScene,
    30
  );

  // Step 6: Build system message
  const systemMessage = buildSystemPrompt(
    personalityText,
    config.userEmotion,
    conversationType,
    config.backgroundStory,
    contextPrompt
  );

  // Step 7: Filter and prepare context messages
  const contextMessages = messages
    .filter((msg) => msg.role !== 'system')
    .slice(-10) // Keep last 10 messages for context
    .map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

  return {
    model,
    systemMessage,
    contextMessages,
    lengthConfig,
    apiKey,
  };
}
