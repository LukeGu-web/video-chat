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
  generateCapabilityPrompt,
  generateEmotionalResponsePrompt,
} from '../../constants/ai';
import { buildScenePrompt, isSceneDataFresh } from '../../capabilities/vision/environment/buildScenePrompt';
import { SceneData } from '../../types/scene';
import { ChatMessage, ChatAIConfig } from '../useChatAI';
import { debugLog, debugWarn } from '../../utils/debug';
import { getRelativeTime } from '../../utils/timeFormat';

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
  freshnessMinutes: number = 30,
  language: 'zh' | 'en' = 'zh'
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
  debugLog('buildAIContext', 'Scene data check', {
    source: metadata.source,
    hasScene: metadata.hasScene,
    isFresh: metadata.isFresh,
    location: metadata.location,
    objectsCount: metadata.objectsCount,
    timestamp: metadata.timestamp,
    ageMinutes: metadata.ageMinutes,
  });

  // Step 4: Build scene prompt if fresh
  const scenePrompt = isFresh ? buildScenePrompt(sceneToUse, true, 5, language) : '';

  // Step 5: Log prompt generation result
  if (scenePrompt) {
    debugLog('buildAIContext', 'Scene prompt generated', scenePrompt.substring(0, 200) + '...');
  } else {
    debugWarn('buildAIContext', 'No scene prompt (scene not fresh or missing)');
  }

  // Step 6: Use scene prompt as context
  const contextPrompt = scenePrompt;

  debugLog('buildAIContext', 'Context prompt length', { length: contextPrompt.length });

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
    maxCharacters: number;
    targetSentences: number;
    allowMultiParagraph: boolean;
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
  currentScene: SceneData | null,
  currentLanguage: 'zh' | 'en' = 'zh'
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
    30,
    currentLanguage
  );

  // Step 6: Build system message
  const systemMessage = buildSystemPrompt(
    personalityText,
    config.userEmotion,
    conversationType,
    config.backgroundStory,
    contextPrompt,
    config.objectRecognitionContext
  );

  // Step 7: Filter and prepare context messages with time annotations
  const contextMessages = messages
    .filter((msg) => msg.role !== 'system')
    .slice(-10) // Keep last 10 messages for context
    .map((msg) => ({
      role: msg.role,
      content: `(${getRelativeTime(msg.timestamp)}) ${msg.content}`,
    }));

  return {
    model,
    systemMessage,
    contextMessages,
    lengthConfig,
    apiKey,
  };
}

/**
 * Cacheable system prompt block type
 * Used for Claude Prompt Caching API
 */
export interface CacheableSystemBlock {
  type: 'text';
  text: string;
  cache_control?: { type: 'ephemeral' };
}

/**
 * Estimate token count (rough approximation: 1 token ≈ 4 chars for Chinese)
 * This is a conservative estimate for safety
 */
function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Get minimum cache size requirement based on model
 */
function getMinCacheTokens(model: string): number {
  // Claude API requirements:
  // - Haiku: 2048 tokens minimum
  // - Sonnet/Opus: 1024 tokens minimum
  return model.includes('haiku') ? 2048 : 1024;
}

/**
 * Build cacheable system prompt for Claude Prompt Caching
 *
 * FIXED: Merged Personality + Capability into single large cache block
 * to meet minimum token requirements (≥1024 for Sonnet, ≥2048 for Haiku)
 *
 * Cache structure:
 * - Block 1 (Cached): Core prompt (Personality + Capability) ~1200 tokens ✅
 * - Block 2 (Dynamic): Emotional response (changes each conversation)
 * - Block 3 (Optional): Background story (if provided)
 * - Block 4 (Optional): Environment context (if provided)
 *
 * @param personality - Core personality prompt
 * @param userEmotion - Current user emotion state
 * @param conversationType - Type of conversation
 * @param backgroundStory - Optional background story
 * @param environmentContext - Optional environment context
 * @param model - Claude model being used (for token requirement check)
 * @returns Array of cacheable system blocks
 *
 * @see https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
 */
export function buildCacheableSystemPrompt(
  personality: string,
  userEmotion: string | undefined,
  conversationType: 'simple' | 'normal' | 'detailed' | 'storytelling',
  backgroundStory?: string,
  environmentContext?: string,
  objectRecognitionContext?: string,
  model: string = 'haiku',
  memoryBlock?: string
): CacheableSystemBlock[] {
  const systemBlocks: CacheableSystemBlock[] = [];

  // Get capability prompt
  const capabilityPrompt = generateCapabilityPrompt();

  // FIX: Merge Personality + Capability into one large block
  // This ensures we meet minimum token requirements
  const corePrompt = `${personality}\n\n${capabilityPrompt}`;
  const coreTokens = estimateTokenCount(corePrompt);
  const minTokens = getMinCacheTokens(model);

  // Block 1: Core prompt (Personality + Capability) - CACHED if large enough
  if (coreTokens >= minTokens) {
    systemBlocks.push({
      type: 'text',
      text: corePrompt,
      cache_control: { type: 'ephemeral' }, // Cache for 5 minutes
    });

    debugLog('buildCacheableSystemPrompt', 'Core prompt cached', {
      tokens: coreTokens,
      minRequired: minTokens,
      meetsRequirement: true,
    });
  } else {
    // Fallback: Don't cache if too small
    systemBlocks.push({
      type: 'text',
      text: corePrompt,
      // No cache_control - too small to cache
    });

    debugWarn('buildCacheableSystemPrompt', 'Core prompt too small for caching', {
      tokens: coreTokens,
      minRequired: minTokens,
      meetsRequirement: false,
    });
  }

  // Block 2: Emotional response (DYNAMIC - not cached)
  // This changes based on user emotion and conversation type
  const emotionalPrompt = generateEmotionalResponsePrompt(
    userEmotion,
    conversationType
  );
  systemBlocks.push({
    type: 'text',
    text: emotionalPrompt,
    // No cache_control - this is dynamic content
  });

  // Block 3: Background story (OPTIONAL - not cached, normal priority)
  if (backgroundStory) {
    systemBlocks.push({
      type: 'text',
      text: backgroundStory,
      // No cache_control - scene-specific content
    });
  }

  // Block 4: Object recognition context (OPTIONAL - not cached, HIGH PRIORITY)
  if (objectRecognitionContext) {
    systemBlocks.push({
      type: 'text',
      text: `# 📸 重要：刚刚识别的物品\n${objectRecognitionContext}\n\n⚠️ 请基于上述识别结果回答用户问题，这是最新的视觉信息，优先级高于之前的对话内容。`,
      // No cache_control - recent recognition data
    });
  }

  // Block 5: Environment context (OPTIONAL - not cached, medium priority)
  if (environmentContext) {
    systemBlocks.push({
      type: 'text',
      text: `# 环境感知\n${environmentContext}`,
      // No cache_control - real-time environment data
    });
  }

  // Memory context — injected without cache_control since it updates frequently
  if (memoryBlock) {
    systemBlocks.push({
      type: 'text',
      text: `# Memory\n${memoryBlock}`,
    });
  }

  debugLog('buildCacheableSystemPrompt', 'Created system blocks', {
    totalBlocks: systemBlocks.length,
    cachedBlocks: systemBlocks.filter((b) => b.cache_control).length,
    dynamicBlocks: systemBlocks.filter((b) => !b.cache_control).length,
    coreTokens,
    minRequired: minTokens,
  });

  return systemBlocks;
}

/**
 * Cacheable message type
 * Used for caching conversation history
 */
export interface CacheableMessage {
  role: string;
  content: string;
  cache_control?: { type: 'ephemeral' };
}

/**
 * Enhanced API request configuration with cacheable system
 */
export interface CacheableAPIRequestConfig extends Omit<APIRequestConfig, 'systemMessage' | 'contextMessages'> {
  systemMessage: string | CacheableSystemBlock[];
  contextMessages: Array<{ role: string; content: string }> | CacheableMessage[];
  enableCache: boolean;
}

/**
 * Build API request configuration with optional caching support
 *
 * @param messages - Chat message history
 * @param config - Chat AI configuration
 * @param conversationType - Type of conversation
 * @param currentPersonality - Current personality prompt
 * @param currentScene - Current scene data from store
 * @param enableCache - Enable prompt caching (default: true in production)
 * @returns Complete API request configuration with optional caching
 */
export function buildCacheableAPIRequestConfig(
  messages: ChatMessage[],
  config: ChatAIConfig,
  conversationType: 'simple' | 'normal' | 'detailed' | 'storytelling',
  currentPersonality: string,
  currentScene: SceneData | null,
  enableCache: boolean = process.env.NODE_ENV === 'production',
  currentLanguage: 'zh' | 'en' = 'zh',
  memoryBlock?: string
): CacheableAPIRequestConfig {
  // Get base configuration (without systemMessage)
  const baseConfig = buildAPIRequestConfig(
    messages,
    config,
    conversationType,
    currentPersonality,
    currentScene,
    currentLanguage
  );

  // Build scene context
  const { contextPrompt } = buildSceneContext(
    config.sceneContext,
    currentScene,
    30,
    currentLanguage
  );

  // Get personality text
  const personalityText = config.personality || currentPersonality;

  // Decide whether to use cacheable format
  let systemMessage: string | CacheableSystemBlock[];

  if (enableCache) {
    // Use cacheable array format with model parameter for token validation
    systemMessage = buildCacheableSystemPrompt(
      personalityText,
      config.userEmotion,
      conversationType,
      config.backgroundStory,
      contextPrompt,
      config.objectRecognitionContext,
      baseConfig.model, // Pass model for token requirement check
      memoryBlock
    );
    debugLog('buildCacheableAPIRequestConfig', 'Using cacheable system prompt format');
  } else {
    // Use traditional string format (backward compatible)
    systemMessage = buildSystemPrompt(
      personalityText,
      config.userEmotion,
      conversationType,
      config.backgroundStory,
      contextPrompt,
      config.objectRecognitionContext
    );
    debugWarn('buildCacheableAPIRequestConfig', 'Using traditional system prompt format (cache disabled)');
  }

  // Build cacheable messages if cache is enabled
  let contextMessages: Array<{ role: string; content: string }> | CacheableMessage[];

  if (enableCache) {
    contextMessages = buildCacheableMessages(
      messages,
      5, // Cache first 5 messages in conversation history
      baseConfig.model // Pass model for token requirement check
    );
  } else {
    // Use traditional message format with time annotations
    contextMessages = messages
      .filter((msg) => msg.role !== 'system')
      .slice(-10)
      .map((msg) => ({
        role: msg.role,
        content: `(${getRelativeTime(msg.timestamp)}) ${msg.content}`,
      }));
  }

  return {
    ...baseConfig,
    systemMessage,
    contextMessages,
    enableCache,
  };
}

/**
 * Build cacheable messages with conversation history caching
 *
 * FIXED: Added token validation - only cache if message history is large enough
 * For safety, we require at least 200 tokens in cached messages
 *
 * Strategy:
 * - Keep last 10 messages for context
 * - Cache first N messages (default: 5) if total size ≥ 200 tokens
 * - Leave recent messages uncached (they change frequently)
 *
 * Cache breakpoint placement:
 * - system: Block 1 (merged personality + capabilities)
 * - messages: Block 2 (early conversation history) - only if large enough
 * - Total: 1-2 cache breakpoints (max 4 allowed)
 *
 * @param messages - Full message history
 * @param cacheHistoryLength - Number of early messages to cache (default: 5)
 * @param model - Claude model being used (for token requirement check)
 * @returns Array of cacheable messages
 *
 * @see https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
 */
export function buildCacheableMessages(
  messages: ChatMessage[],
  cacheHistoryLength: number = 5,
  model: string = 'haiku'
): CacheableMessage[] {
  // Filter and prepare context messages (last 10 messages)
  const contextMessages = messages
    .filter((msg) => msg.role !== 'system')
    .slice(-10);

  // If we don't have enough messages, don't cache
  if (contextMessages.length <= cacheHistoryLength) {
    debugLog('buildCacheableMessages', 'Not enough messages to cache, using standard format');
    return contextMessages.map((msg) => ({
      role: msg.role,
      content: `(${getRelativeTime(msg.timestamp)}) ${msg.content}`,
    }));
  }

  // Split messages into cached (stable) and recent (dynamic)
  const cachedMessages = contextMessages.slice(0, cacheHistoryLength);
  const recentMessages = contextMessages.slice(cacheHistoryLength);

  // FIX: Estimate total tokens in cached messages
  const cachedText = cachedMessages.map((m) => m.content).join('\n');
  const cachedTokens = estimateTokenCount(cachedText);

  // Conservative requirement: at least 200 tokens for message caching
  // (Much lower than system prompt requirement since messages come after system)
  const MIN_MESSAGE_CACHE_TOKENS = 200;

  // Build cacheable message array
  const cacheableMessages: CacheableMessage[] = [];

  // Add cached messages (all but the last one) with time annotations
  for (let i = 0; i < cachedMessages.length - 1; i++) {
    cacheableMessages.push({
      role: cachedMessages[i].role,
      content: `(${getRelativeTime(cachedMessages[i].timestamp)}) ${cachedMessages[i].content}`,
    });
  }

  // Add cache breakpoint to the last cached message (only if large enough)
  if (cachedMessages.length > 0) {
    const lastCached = cachedMessages[cachedMessages.length - 1];

    if (cachedTokens >= MIN_MESSAGE_CACHE_TOKENS) {
      cacheableMessages.push({
        role: lastCached.role,
        content: `(${getRelativeTime(lastCached.timestamp)}) ${lastCached.content}`,
        cache_control: { type: 'ephemeral' }, // Cache breakpoint 2
      });

      debugLog('buildCacheableMessages', 'Message history cached', {
        tokens: cachedTokens,
        minRequired: MIN_MESSAGE_CACHE_TOKENS,
        meetsRequirement: true,
      });
    } else {
      // Don't cache if too small
      cacheableMessages.push({
        role: lastCached.role,
        content: `(${getRelativeTime(lastCached.timestamp)}) ${lastCached.content}`,
        // No cache_control
      });

      debugWarn('buildCacheableMessages', 'Message history too small for caching', {
        tokens: cachedTokens,
        minRequired: MIN_MESSAGE_CACHE_TOKENS,
        meetsRequirement: false,
      });
    }
  }

  // Add recent messages (not cached) with time annotations
  for (const msg of recentMessages) {
    cacheableMessages.push({
      role: msg.role,
      content: `(${getRelativeTime(msg.timestamp)}) ${msg.content}`,
    });
  }

  debugLog('buildCacheableMessages', 'Created cacheable messages', {
    totalMessages: cacheableMessages.length,
    cachedMessages: cachedMessages.length,
    recentMessages: recentMessages.length,
    cachedTokens,
    cacheBreakpoints: cachedTokens >= MIN_MESSAGE_CACHE_TOKENS ? 1 : 0,
  });

  return cacheableMessages;
}
