import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  CLAUDE_API_CONFIG,
  AI_ERROR_MESSAGES,
  createPersonalitySystemPrompt,
  validateAndOptimizeResponse,
  detectConversationType,
  FISH_AUDIO_CONFIG,
} from '../constants/ai';
import { parseSSEChunk } from '../capabilities/speak/sentenceDetector'; // Phase 2: 句子检测
import { TTSQueue } from '../capabilities/speak'; // Phase 2: TTS队列管理 - NEW ARCHITECTURE
import { stripActionDescriptions } from '../capabilities/speak/fishAudioAPI'; // Strip (动作) tags before TTS/display
// import { SmartSentenceBuffer } from '../capabilities/speak/smartSentenceBuffer'; // Phase 3: 智能句子过滤 - DISABLED (causes incomplete sentences)
import { useSceneStore } from '../store/sceneStore'; // Scene context
import { SceneData } from '../types/scene'; // Scene data type
import { buildCacheableAPIRequestConfig } from './ai/buildAIContext'; // Unified API config builder with caching support (Step 1.1: Refactoring)
import { buildMemoryContext } from './ai/buildMemoryContext'; // Memory block injection (Task 5)
import { useMemoryStore } from '../store/memoryStore'; // Memory store for profile and preferences
import { useProactiveConversation } from './ai/useProactiveConversation'; // Proactive conversation system (Step 1.2: Refactoring)
import { detectUserEmotionFromText } from '../utils/emotionDetection'; // Emotion detection (Step 1.3: Refactoring)
import {
  trackCacheUsage,
  parseCacheUsageFromSSE,
  getCacheStatsReport,
} from '../utils/cacheMetrics'; // Phase 2: Cache metrics tracking
import { debugLog } from '../utils/debug'; // Debug logging utilities
import { executeRAG, type RAGResult } from '../capabilities/retrieval'; // RAG system (Phase 1: Retrieval-Augmented Generation)
import { textToViseme } from '../capabilities/speak/textToViseme';
import { parseVRMAction } from '../utils/parseVRMAction';
import { motionCoordinator } from '../capabilities/motion';
import { useEmotionStore } from '../store';
import { TTSSynthesisOptions } from '../types/speak';
import { EmotionType } from '../types/emotion';
import {
  shouldRequestFeedback,
  submitFeedback,
  type RetrievalFeedback,
} from '../capabilities/retrieval'; // Phase 3: User feedback system
import { useChatStore, ChatMessage } from '../store/chatStore'; // Chat history persistence
import { useUserStore } from '../store/userStore'; // User preferences and language state
import { detectLanguage } from '../utils/languageDetection'; // Language detection

// Re-export ChatMessage for convenience
export type { ChatMessage };

export interface ChatAIConfig {
  personality?: string;
  modelType?: 'haiku' | 'sonnet';
  apiKey?: string;
  enableTTS?: boolean; // 是否启用语音合成
  voiceId?: string; // ElevenLabs 语音 ID
  userEmotion?: string; // 用户当前情绪状态
  backgroundStory?: string; // 背景故事上下文
  objectRecognitionContext?: string; // 物体识别结果上下文（高优先级，带强调标记）
  sceneContext?: SceneData | null; // 场景上下文（Step 5.2: 直接传递，避免状态更新延迟）
  isVoiceMessage?: boolean; // 是否为语音消息
}

export interface UseChatAIReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  isSpeaking: boolean; // TTS 播放状态
  isGenerating: boolean; // TTS 生成状态
  error: string | null;
  sendMessage: (content: string, config?: ChatAIConfig) => Promise<void>;
  clearMessages: () => void;
  setPersonality: (personality: string) => void;
  stopSpeaking: () => void; // 停止 TTS 播放
  currentSegment: string; // 当前正在播放的语音片段
  enableProactiveMode: (enabled: boolean) => void; // 启用/禁用主动对话
  isProactiveModeEnabled: boolean; // 主动对话模式状态
  getCacheStats: () => string; // Phase 2: 获取缓存统计报告
  // Phase 3: User feedback system
  shouldShowFeedback: boolean; // 是否应该显示反馈提示
  submitUserFeedback: (
    rating: 'helpful' | 'not_helpful' | 'neutral',
    comment?: string
  ) => void; // 提交用户反馈
  dismissFeedback: () => void; // 关闭反馈提示
}

// 预设人格模板和API配置现在从 constants/ai.ts 导入

// 使用兰兰人格的便捷函数
export const useChatAIWithLanLan = (
  initialConfig?: Omit<ChatAIConfig, 'personality'>
) => {
  return useChatAI({
    ...initialConfig,
    personality: createPersonalitySystemPrompt(),
    voiceId: FISH_AUDIO_CONFIG.voices.lanlan, // use Fish Audio reference ID for 兰兰
  });
};

export const useChatAI = (initialConfig?: ChatAIConfig): UseChatAIReturn => {
  // Use chatHistory directly from store as single source of truth
  const messages = useChatStore((state) => state.chatHistory);
  const addChatMessage = useChatStore((state) => state.addChatMessage);
  const clearChatHistory = useChatStore((state) => state.clearChatHistory);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPersonality, setCurrentPersonality] = useState(
    initialConfig?.personality || createPersonalitySystemPrompt()
  );
  const [isProactiveModeEnabled, setIsProactiveModeEnabled] = useState(true);

  // Get current scene context from store (Step 5.1)
  const currentScene = useSceneStore((state) => state.currentScene);

  // Get memory profile and preferences for memory block injection (Task 5)
  const { profile, preferences } = useMemoryStore();
  // Memoize DB reads: buildMemoryContext calls getAllSync twice; re-run only when
  // profile or preferences change to avoid redundant SQLite reads on every render.
  const { memoryBlock } = useMemo(
    () => buildMemoryContext(profile, preferences),
    [profile, preferences]
  );

  // Phase 3: Global TTS queue reference for user interruption
  const currentTTSQueue = useRef<TTSQueue | null>(null);

  // Phase 3: Streaming TTS state tracking
  const [isStreamGenerating, setIsStreamGenerating] = useState(false); // Claude streaming
  const [isStreamSpeaking, setIsStreamSpeaking] = useState(false); // TTS queue playing
  const [currentStreamSegment, setCurrentStreamSegment] = useState(''); // Current sentence being spoken

  // Phase 3: User feedback system
  const [lastRAGResult, setLastRAGResult] = useState<RAGResult | null>(null);
  const [shouldShowFeedback, setShouldShowFeedback] = useState(false);

  const generateMessageId = () => {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  };

  // Step 1.2: Use extracted proactive conversation hook
  const proactiveConversation = useProactiveConversation({
    enabled: isProactiveModeEnabled,
    messages,
    isLoading,
    isSpeaking: isStreamSpeaking,
    onProactiveMessage: async (content: string) => {
      // Add proactive message to history
      const proactiveMessage: ChatMessage = {
        id: generateMessageId(),
        role: 'assistant',
        content: content.trim(),
        timestamp: Date.now(),
      };
      addChatMessage(proactiveMessage);
    },
    onSpeakingStateChange: (isSpeaking, segment) => {
      setIsStreamSpeaking(isSpeaking);
      setCurrentStreamSegment(segment);
    },
  });

  // Step 1.4: Removed callClaudeAPI (non-streaming) - only using streaming API now
  // Streaming API call with sentence-by-sentence TTS
  // Note: Using XMLHttpRequest for streaming in React Native
  const callClaudeAPIStreaming = async (
    messages: ChatMessage[],
    config: ChatAIConfig,
    conversationType:
      | 'simple'
      | 'normal'
      | 'detailed'
      | 'storytelling' = 'normal',
    onSentence: (sentence: string, options?: TTSSynthesisOptions) => void
  ): Promise<string> => {
    // Get current language from user store
    const currentLanguage = useUserStore.getState().currentLanguage;

    // Generate language-aware personality
    const languageAwarePersonality = createPersonalitySystemPrompt(currentLanguage);

    // Step 1.1: Use cacheable API config builder with prompt caching support
    const apiConfig = buildCacheableAPIRequestConfig(
      messages,
      config,
      conversationType,
      languageAwarePersonality,
      currentScene,
      true, // Enable cache in production (will auto-detect NODE_ENV)
      currentLanguage,
      memoryBlock // Task 5: Inject memory block into system prompt
    );

    const requestBody = {
      model: apiConfig.model,
      max_tokens: apiConfig.lengthConfig.maxTokens,
      system: apiConfig.systemMessage, // Can be string or array of CacheableSystemBlock
      messages: apiConfig.contextMessages,
      stop_sequences: ['用户:', 'User:', '---'],
      stream: true, // Enable streaming
    };

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', CLAUDE_API_CONFIG.baseURL, true);
      xhr.responseType = 'text'; // Important for streaming

      // Set headers
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('x-api-key', apiConfig.apiKey);
      xhr.setRequestHeader('anthropic-version', CLAUDE_API_CONFIG.version);

      // Phase 1: Enable Prompt Caching (if cache is enabled)
      if (apiConfig.enableCache) {
        xhr.setRequestHeader('anthropic-beta', 'prompt-caching-2024-07-31');
        console.log('[ChatAI] ✅ Prompt Caching enabled');
      }

      let fullText = '';
      let processedLength = 0;

      // Phase 3: DISABLED - SmartSentenceBuffer temporary disabled
      // Reason: Causes incomplete sentences that change original meaning
      // Solution: Using improved AI prompts to reduce verbosity instead
      // const smartBuffer = new SmartSentenceBuffer({
      //   conversationType,
      //   debug: true,
      // });

      // Simple sentence buffer for direct streaming (no filtering)
      let partialSentence = '';
      let rawBuffer = ''; // accumulates raw text to handle cross-chunk <action> blocks
      let prevCleanCommitted = 0; // tracks cleanText length from previous iteration
      const sentenceEndings = ['。', '！', '？', '~', '…', '呢', '哦', '啊', '呀'];

      // Track processed lines to avoid duplicates
      const processedLines = new Set<string>();

      // Handle streaming progress
      xhr.onprogress = () => {
        const responseText = xhr.responseText;

        let pendingHint: string | null = null; // attached to the next enqueued sentence

        // Only process new content
        if (responseText.length > processedLength) {
          const newContent = responseText.slice(processedLength);
          processedLength = responseText.length;

          // Process SSE lines
          const lines = newContent.split('\n');

          for (const line of lines) {
            if (line.trim() === '' || processedLines.has(line)) continue;
            processedLines.add(line);

            // Parse SSE chunk
            const text = parseSSEChunk(line);
            if (text) {
              rawBuffer += text;

              // Strip complete <action> blocks; dispatch last found action
              const { intent, cleanText, hasPartialTag } = parseVRMAction(rawBuffer);
              if (intent) {
                const STORE_EMOTION_MAP: Record<string, string> = { laugh: 'joy', sad: 'sadness' };
                const storeEmotion = STORE_EMOTION_MAP[intent.emotion] ?? intent.emotion;
                useEmotionStore.getState().setTextEmotion(storeEmotion as EmotionType);
                motionCoordinator.onAIAction(intent.emotion);
                pendingHint = intent.emotion;
                debugLog('ChatAI', 'AI action dispatched', intent);
              }

              // Keep only unprocessed raw text in rawBuffer
              rawBuffer = hasPartialTag
                ? rawBuffer.slice(rawBuffer.lastIndexOf('<action>'))
                : '';

              // Feed clean text into sentence buffer
              // cleanText is relative to current rawBuffer — use prevCleanCommitted to compute delta
              const newChars = cleanText.slice(prevCleanCommitted);
              prevCleanCommitted = hasPartialTag ? cleanText.length : 0;
              partialSentence += newChars;

              // Extract complete sentences
              let currentSentence = '';
              for (let i = 0; i < partialSentence.length; i++) {
                const char = partialSentence[i];
                currentSentence += char;

                if (sentenceEndings.includes(char)) {
                  const sentence = stripActionDescriptions(currentSentence.trim());
                  if (sentence) {
                    const LAUGH_PATTERN = /^[哈嘿呵hH]+[哈嘿呵!！~～\s]*$/;
                    const hint = pendingHint ?? (LAUGH_PATTERN.test(sentence) ? 'laugh' : undefined);
                    pendingHint = null; // consume after first sentence

                    debugLog('ChatAI', 'Playing complete sentence (unfiltered)', {
                      sentence,
                    });
                    onSentence(sentence, hint ? { animationHint: hint } : undefined);
                    fullText += sentence;
                  }
                  currentSentence = '';
                }
              }

              partialSentence = currentSentence;
            }
          }
        }
      };

      // Handle completion
      xhr.onload = () => {
        if (xhr.status === 200) {
          try {
            // DISABLED: SmartBuffer flush
            // Now flush remaining partial sentence directly without filtering
            rawBuffer = '';
            if (partialSentence.trim()) {
              const { cleanText: cleanFinal } = parseVRMAction(partialSentence.trim());
              const finalSentence = stripActionDescriptions(cleanFinal);
              if (finalSentence) {
                debugLog('ChatAI', 'Playing final sentence (unfiltered)', {
                  finalSentence,
                });
                onSentence(finalSentence);
                fullText += finalSentence;
              }
            }

            // Phase 2: Track cache usage from API response
            if (apiConfig.enableCache) {
              const cacheUsage = parseCacheUsageFromSSE(xhr.responseText);
              if (cacheUsage) {
                trackCacheUsage(cacheUsage);
              } else {
                console.warn(
                  '[ChatAI] ⚠️ Could not parse cache usage from response'
                );
              }
            }

            // Validate and optimize final response (Layer 3 safety check)
            const optimizedResponse = validateAndOptimizeResponse(
              fullText,
              conversationType
            );
            resolve(optimizedResponse);
          } catch (error) {
            reject(new Error(`Response processing failed: ${error}`));
          }
        } else {
          reject(
            new Error(`${AI_ERROR_MESSAGES.API_CALL_FAILED}: ${xhr.status}`)
          );
        }
      };

      // Handle errors
      xhr.onerror = () => {
        reject(new Error('Network request failed'));
      };

      // Send request
      xhr.send(JSON.stringify(requestBody));
    });
  };

  // Phase 2: Streaming send message with TTS queue
  const sendMessage = useCallback(
    async (content: string, config?: ChatAIConfig) => {
      if (!content.trim()) return;

      setIsLoading(true);
      setError(null);

      // Add user message
      const userMessage: ChatMessage = {
        id: generateMessageId(),
        role: 'user',
        content: content.trim(),
        timestamp: Date.now(),
        isVoiceMessage: config?.isVoiceMessage,
      };

      // Save to persistent storage
      addChatMessage(userMessage);

      const updatedMessages = [...messages, userMessage];

      // Update proactive conversation timer
      proactiveConversation.resetTimer();

      // Detect language and update language state (Language support)
      const detectedLanguage = detectLanguage(content);
      useUserStore.getState().setCurrentLanguage(detectedLanguage);
      debugLog('ChatAI', 'Language detected', {
        content,
        detectedLanguage,
      });

      // Detect emotion (Step 1.3: Use extracted function)
      const detectedEmotion = detectUserEmotionFromText(content);

      // Detect conversation type
      const conversationType = detectConversationType(content, updatedMessages);
      debugLog('ChatAI', 'Phase 2: 对话类型检测', {
        content,
        conversationType,
      });

      // === RAG Phase 1: Retrieval-Augmented Generation ===
      const ragResult = await executeRAG(content, {
        enableRetrieval: true,
        maxContextTokens: 500,
        minRelevanceThreshold: 0.3,
      });

      // Phase 3: Store RAG result for potential feedback
      setLastRAGResult(ragResult);

      debugLog('ChatAI', 'RAG检索完成', {
        isTriggered: ragResult.isRetrievalTriggered,
        totalFound: ragResult.retrieval.metadata.totalFound,
        contextLength: ragResult.context.length,
        intent: ragResult.analysis.intent,
      });

      // Enhanced config with emotion and RAG context
      const enhancedConfig = {
        ...config,
        userEmotion: config?.userEmotion || detectedEmotion,
        // Add RAG context to background story (priority over manual background story)
        backgroundStory: ragResult.context || config?.backgroundStory,
      };

      // Initialize TTS queue (Phase 3: Store in ref for interruption)
      const voiceId = enhancedConfig?.voiceId || FISH_AUDIO_CONFIG.voices.lanlan;
      const userEmotion = enhancedConfig?.userEmotion;
      const ttsQueue = new TTSQueue({
        // Phase 3: Callbacks for subtitle display
        onItemStart: (item) => {
          setCurrentStreamSegment(item.text);
          if (!isStreamSpeaking) {
            setIsStreamSpeaking(true);
          }
          // Lip sync: prepare visemes (two-phase: store without starting)
          const { visemes, totalDuration } = textToViseme(item.text);
          motionCoordinator.onVisemes({ visemes, totalDuration });
        },
        onItemEnd: () => {
          const status = ttsQueue.getStatus();
          const isLastItem =
            status.pending === 0 &&
            status.ready === 0 &&
            status.synthesizing === 0;
          if (isLastItem) {
            setCurrentStreamSegment('');
            // Only close mouth when no more items follow to avoid race with next prepareVisemes
            motionCoordinator.onStopVisemes();
          }
        },
      });

      // Store current TTS queue for potential interruption
      currentTTSQueue.current = ttsQueue;

      try {
        // Phase 3: Set generating state
        setIsStreamGenerating(true);

        // Stream API call with sentence-by-sentence TTS
        const aiResponse = await callClaudeAPIStreaming(
          updatedMessages,
          enhancedConfig,
          conversationType,
          async (sentence, sentenceOptions) => {
            // Enqueue sentence for TTS
            if (enhancedConfig?.enableTTS !== false) {
              debugLog('ChatAI', 'Phase 2: 加入TTS队列', { sentence });
              await ttsQueue.enqueue(sentence, {
                voiceId,
                emotion: userEmotion,
                ...sentenceOptions,
              });
            }
          }
        );

        // Phase 3: Generating complete, now speaking
        setIsStreamGenerating(false);

        // Add AI message with full response
        const aiMessage: ChatMessage = {
          id: generateMessageId(),
          role: 'assistant',
          content: aiResponse,
          timestamp: Date.now(),
          conversationType: conversationType,
          isVoiceMessage: config?.isVoiceMessage,
        };

        // Save to persistent storage
        addChatMessage(aiMessage);

        // Wait for TTS queue to finish
        if (enhancedConfig?.enableTTS !== false) {
          debugLog('ChatAI', 'Phase 2: 等待TTS队列完成');
          setIsStreamSpeaking(true); // Phase 3: Set speaking state
          await ttsQueue.waitForCompletion();
          setIsStreamSpeaking(false); // Phase 3: Clear speaking state
          debugLog('ChatAI', 'Phase 2: TTS队列播放完成');
        }

        // Phase 3: Check if we should request user feedback
        if (shouldRequestFeedback(ragResult.isRetrievalTriggered)) {
          setShouldShowFeedback(true);
          debugLog('ChatAI', 'Phase 3: Requesting user feedback');
        }

        // Start proactive conversation detection
        setTimeout(() => {
          proactiveConversation.startTimer();
        }, 1000);
      } catch (err) {
        console.error('[ChatAI] Phase 2 error:', err);
        setError(err instanceof Error ? err.message : '发送消息失败');

        // Phase 3: Clear states on error
        setIsStreamGenerating(false);
        setIsStreamSpeaking(false);
        setCurrentStreamSegment('');

        // Cancel TTS queue on error
        ttsQueue.cancel();
        motionCoordinator.onStopVisemes();

        // Add error message
        const errorMessage: ChatMessage = {
          id: generateMessageId(),
          role: 'assistant',
          content: '抱歉，我现在无法回复。请稍后重试。',
          timestamp: Date.now(),
        };

        // Save to persistent storage
        addChatMessage(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, currentPersonality, proactiveConversation]
  );

  const clearMessages = useCallback(() => {
    setError(null);
    // Clear persistent storage (this will also clear messages from store)
    clearChatHistory();
    proactiveConversation.resetTimer();
  }, [proactiveConversation, clearChatHistory]);

  const setPersonality = useCallback((personality: string) => {
    setCurrentPersonality(personality);
  }, []);

  /**
   * Stop all audio playback (Phase 3: Enhanced for user interruption)
   * Stops:
   * 1. Current TTS queue playback (conversation)
   * 2. Proactive message TTS queue (handled by proactiveConversation hook)
   * 3. Clears all loading/generating/speaking states
   */
  const stopSpeaking = useCallback(async () => {
    console.log('[ChatAI] 🛑 User interruption - stopping all audio');

    // Phase 3: Clear ALL states (including isLoading)
    setIsLoading(false); // CRITICAL: Clear loading state to allow new messages
    setIsStreamGenerating(false);
    setIsStreamSpeaking(false);
    setCurrentStreamSegment('');

    // 1. Stop conversation TTS queue if active
    if (currentTTSQueue.current) {
      try {
        await currentTTSQueue.current.cancel();
        // Close VRM mouth immediately since onItemEnd is not called on cancel
        motionCoordinator.onStopVisemes();
        debugLog('ChatAI', 'Conversation TTS queue cancelled');
      } catch (error) {
        console.error(
          '[ChatAI] Error cancelling conversation TTS queue:',
          error
        );
      }
      currentTTSQueue.current = null;
    }

    // 2. Stop proactive conversation timer and TTS (managed by hook)
    proactiveConversation.stopTimer();
  }, [proactiveConversation]);

  const enableProactiveMode = useCallback(
    (enabled: boolean) => {
      setIsProactiveModeEnabled(enabled);
      if (!enabled) {
        proactiveConversation.stopTimer();
      } else {
        // 如果启用且有消息，重新开始检测
        if (messages.length > 0) {
          setTimeout(() => {
            proactiveConversation.startTimer();
          }, 1000);
        }
      }
    },
    [proactiveConversation, messages.length]
  );

  // 组件卸载时清理定时器 (handled by useProactiveConversation hook)
  // useEffect removed - cleanup is now managed by the proactiveConversation hook

  // 当语音播放状态改变时，调整主动对话检测
  useEffect(() => {
    if (
      !isStreamSpeaking &&
      !isLoading &&
      isProactiveModeEnabled &&
      messages.length > 0
    ) {
      setTimeout(() => {
        proactiveConversation.startTimer();
      }, 2000); // 语音结束后2秒开始检测
    } else if (isStreamSpeaking || isLoading) {
      proactiveConversation.stopTimer();
    }
  }, [
    isStreamSpeaking,
    isLoading,
    isProactiveModeEnabled,
    messages.length,
    proactiveConversation,
  ]);

  // Phase 2: Get cache statistics report
  const getCacheStats = useCallback(() => {
    return getCacheStatsReport();
  }, []);

  // Phase 3: Submit user feedback
  const submitUserFeedback = useCallback(
    (rating: 'helpful' | 'not_helpful' | 'neutral', comment?: string) => {
      if (!lastRAGResult) {
        debugLog('ChatAI', 'Phase 3: No RAG result to submit feedback for');
        return;
      }

      const feedbackData = {
        queryText: messages[messages.length - 2]?.content || '', // User's last message
        rating,
        retrievalMetadata: {
          totalFound: lastRAGResult.retrieval.metadata.totalFound,
          averageRelevance: lastRAGResult.retrieval.metadata.averageRelevance || 0,
          sourcesUsed: lastRAGResult.retrieval.metadata.sources,
          contextLength: lastRAGResult.context.length,
        },
        userComment: comment,
      };

      const feedback = submitFeedback(feedbackData);

      debugLog('ChatAI', 'Phase 3: User feedback submitted', {
        feedbackId: feedback.id,
        rating,
      });

      // Hide feedback prompt
      setShouldShowFeedback(false);
    },
    [lastRAGResult, messages]
  );

  // Phase 3: Dismiss feedback prompt
  const dismissFeedback = useCallback(() => {
    setShouldShowFeedback(false);
    debugLog('ChatAI', 'Phase 3: Feedback dismissed');
  }, []);

  return {
    messages,
    isLoading,
    // Phase 3: Use streaming TTS states from TTSQueue
    isSpeaking: isStreamSpeaking,
    isGenerating: isStreamGenerating,
    error,
    sendMessage,
    clearMessages,
    setPersonality,
    stopSpeaking,
    currentSegment: currentStreamSegment,
    enableProactiveMode,
    isProactiveModeEnabled,
    getCacheStats, // Phase 2: Cache statistics
    // Phase 3: User feedback
    shouldShowFeedback,
    submitUserFeedback,
    dismissFeedback,
  };
};
