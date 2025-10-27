import { useState, useCallback, useEffect, useRef } from 'react';
import { useHybridTTS, TTSProvider } from './useHybridTTS';
import {
  CLAUDE_API_CONFIG,
  getClaudeApiKey,
  AI_ERROR_MESSAGES,
  buildSystemPrompt,
  createPersonalitySystemPrompt,
  validateAndOptimizeResponse,
  PROACTIVE_CONVERSATION_CONFIG,
  selectProactiveTopic,
  detectConversationType,
  getResponseLengthConfig
} from '../constants/ai';
import { transitionAudio } from './transitionAudio'; // Phase 1: 过渡语音管理
import { detectTransitionCategory, type Emotion } from './conversationAnalysis'; // Phase 1: 对话分析
import { SentenceBuffer, parseSSEChunk } from './sentenceDetector'; // Phase 2: 句子检测
import { TTSQueue } from './ttsQueue'; // Phase 2: TTS队列管理
import { SmartSentenceBuffer } from './smartSentenceBuffer'; // Phase 3: 智能句子过滤

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  conversationType?: 'simple' | 'normal' | 'detailed' | 'storytelling'; // 对话类型（可选，用于调试）
}

export interface ChatAIConfig {
  personality?: string;
  modelType?: 'haiku' | 'sonnet';
  apiKey?: string;
  enableTTS?: boolean; // 是否启用语音合成
  ttsProvider?: TTSProvider; // TTS 提供商选择
  voiceId?: string; // ElevenLabs 语音 ID
  userEmotion?: string; // 用户当前情绪状态
  backgroundStory?: string; // 背景故事上下文
}

export interface UseChatAIReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  isSpeaking: boolean; // TTS 播放状态
  isGenerating: boolean; // TTS 生成状态
  error: string | null;
  currentTTSProvider: TTSProvider; // 当前TTS提供商
  sendMessage: (content: string, config?: ChatAIConfig) => Promise<void>;
  clearMessages: () => void;
  setPersonality: (personality: string) => void;
  stopSpeaking: () => void; // 停止 TTS 播放
  switchTTSProvider: (provider: TTSProvider) => void; // 切换TTS提供商
  currentSegment: string; // 当前正在播放的语音片段
  enableProactiveMode: (enabled: boolean) => void; // 启用/禁用主动对话
  isProactiveModeEnabled: boolean; // 主动对话模式状态
}

// 预设人格模板和API配置现在从 constants/ai.ts 导入

// 使用兰兰人格的便捷函数
export const useChatAIWithLanLan = (initialConfig?: Omit<ChatAIConfig, 'personality'>) => {
  return useChatAI({
    ...initialConfig,
    personality: createPersonalitySystemPrompt(),
    voiceId: 'hkfHEbBvdQFNX4uWHqRF' // 使用兰兰的专用语音
  });
};

export const useChatAI = (initialConfig?: ChatAIConfig): UseChatAIReturn => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPersonality, setCurrentPersonality] = useState(
    initialConfig?.personality || createPersonalitySystemPrompt()
  );
  const [isProactiveModeEnabled, setIsProactiveModeEnabled] = useState(true);

  // 主动对话相关状态
  const lastUserMessageTime = useRef<number>(Date.now());
  const proactiveTimer = useRef<NodeJS.Timeout | null>(null);
  const hasShownProactiveMessage = useRef<boolean>(false);

  // Phase 3: Global TTS queue reference for user interruption
  const currentTTSQueue = useRef<TTSQueue | null>(null);

  // Phase 3: Streaming TTS state tracking
  const [isStreamGenerating, setIsStreamGenerating] = useState(false); // Claude streaming
  const [isStreamSpeaking, setIsStreamSpeaking] = useState(false); // TTS queue playing
  const [currentStreamSegment, setCurrentStreamSegment] = useState(''); // Current sentence being spoken

  // 集成混合 TTS 功能
  const {
    isSpeaking,
    isGenerating,
    speak,
    stop: stopTTS,
    error: ttsError,
    currentProvider,
    switchProvider,
    currentSegment
  } = useHybridTTS({
    preferredProvider: initialConfig?.ttsProvider || 'elevenlabs',
    fallbackToExpo: true
  });

  const generateMessageId = () => {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  };

  // 简单的情绪检测函数
  const detectUserEmotion = (userMessage: string): string => {
    const message = userMessage.toLowerCase();
    
    // 开心相关词汇
    if (message.includes('开心') || message.includes('高兴') || message.includes('快乐') || 
        message.includes('哈哈') || message.includes('嘿嘿') || message.includes('棒')) {
      return 'happy';
    }
    
    // 难过相关词汇
    if (message.includes('难过') || message.includes('伤心') || message.includes('沮丧') || 
        message.includes('哭') || message.includes('郁闷') || message.includes('失落')) {
      return 'sad';
    }
    
    // 困惑相关词汇
    if (message.includes('困惑') || message.includes('不明白') || message.includes('不懂') || 
        message.includes('？') || message.includes('怎么')) {
      return 'confused';
    }
    
    // 紧张相关词汇
    if (message.includes('紧张') || message.includes('害怕') || message.includes('担心') || 
        message.includes('不安') || message.includes('焦虑')) {
      return 'nervous';
    }
    
    return 'neutral';
  };

  // 清理主动对话定时器
  const clearProactiveTimer = useCallback(() => {
    if (proactiveTimer.current) {
      clearTimeout(proactiveTimer.current);
      proactiveTimer.current = null;
    }
  }, []);

  // 启动主动对话检测
  const startProactiveConversation = useCallback(() => {
    if (!isProactiveModeEnabled || isLoading || isSpeaking) return;
    
    clearProactiveTimer();
    hasShownProactiveMessage.current = false;
    
    // 设置短暂停顿检测
    proactiveTimer.current = setTimeout(() => {
      if (!hasShownProactiveMessage.current && isProactiveModeEnabled) {
        hasShownProactiveMessage.current = true;
        const topic = selectProactiveTopic('short', messages);
        sendProactiveMessage(topic);
        
        // 设置中等停顿检测
        proactiveTimer.current = setTimeout(() => {
          if (isProactiveModeEnabled) {
            const mediumTopic = selectProactiveTopic('medium', messages);
            sendProactiveMessage(mediumTopic);
            
            // 设置长时间停顿检测
            proactiveTimer.current = setTimeout(() => {
              if (isProactiveModeEnabled) {
                const longTopic = selectProactiveTopic('long', messages);
                sendProactiveMessage(longTopic);
              }
            }, PROACTIVE_CONVERSATION_CONFIG.silenceDetection.longPause - PROACTIVE_CONVERSATION_CONFIG.silenceDetection.mediumPause);
          }
        }, PROACTIVE_CONVERSATION_CONFIG.silenceDetection.mediumPause - PROACTIVE_CONVERSATION_CONFIG.silenceDetection.shortPause);
      }
    }, PROACTIVE_CONVERSATION_CONFIG.silenceDetection.shortPause);
  }, [isProactiveModeEnabled, isLoading, isSpeaking]);

  // 发送主动消息
  const sendProactiveMessage = useCallback(async (content: string) => {
    if (!content.trim() || !isProactiveModeEnabled) return;

    const proactiveMessage: ChatMessage = {
      id: generateMessageId(),
      role: 'assistant',
      content: content.trim(),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, proactiveMessage]);

    // 自动播放主动消息
    setTimeout(() => {
      const voiceId = 'hkfHEbBvdQFNX4uWHqRF';
      speak(content, voiceId, 'caring').catch(() => {
        // TTS error handled silently
      });
    }, 300);
  }, [isProactiveModeEnabled, speak]);

  // Phase 1: Non-streaming API call (kept for fallback)
  const callClaudeAPI = async (
    messages: ChatMessage[],
    config: ChatAIConfig,
    conversationType: 'simple' | 'normal' | 'detailed' | 'storytelling' = 'normal'
  ): Promise<string> => {
    const apiKey = config.apiKey || getClaudeApiKey();
    if (!apiKey) {
      throw new Error(AI_ERROR_MESSAGES.API_KEY_MISSING);
    }

    const model = config.modelType
      ? CLAUDE_API_CONFIG.models[config.modelType]
      : CLAUDE_API_CONFIG.models[CLAUDE_API_CONFIG.defaultModel];

    // 获取动态token配置
    const lengthConfig = getResponseLengthConfig(conversationType);

    // 构建API消息格式，包含人格、情绪、上下文信息和背景故事
    const personalityText = config.personality || currentPersonality;
    const systemMessage = buildSystemPrompt(
      personalityText,
      config.userEmotion,
      conversationType,
      config.backgroundStory
    );

    // 保留更多上下文消息以保持对话连贯性
    const contextMessages = messages
      .filter((msg) => msg.role !== 'system')
      .slice(-10) // 保留最近10条消息作为上下文
      .map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

    const requestBody = {
      model,
      max_tokens: lengthConfig.maxTokens, // 使用动态token配置
      system: systemMessage,
      messages: contextMessages,
      stop_sequences: ["用户:", "User:", "---"], // Phase 1: 添加停止序列优化 (移除 \n\n)
    };

    const response = await fetch(CLAUDE_API_CONFIG.baseURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': CLAUDE_API_CONFIG.version,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(
        errorData?.error?.message ||
          `${AI_ERROR_MESSAGES.API_CALL_FAILED}: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    const rawResponse = data.content?.[0]?.text || '抱歉，我无法生成回复。';

    // 验证和优化回应格式，传入对话类型
    return validateAndOptimizeResponse(rawResponse, conversationType);
  };

  // Phase 2: Streaming API call with sentence-by-sentence TTS
  // Note: Using XMLHttpRequest for streaming in React Native
  const callClaudeAPIStreaming = async (
    messages: ChatMessage[],
    config: ChatAIConfig,
    conversationType: 'simple' | 'normal' | 'detailed' | 'storytelling' = 'normal',
    onSentence: (sentence: string) => void
  ): Promise<string> => {
    const apiKey = config.apiKey || getClaudeApiKey();
    if (!apiKey) {
      throw new Error(AI_ERROR_MESSAGES.API_KEY_MISSING);
    }

    const model = config.modelType
      ? CLAUDE_API_CONFIG.models[config.modelType]
      : CLAUDE_API_CONFIG.models[CLAUDE_API_CONFIG.defaultModel];

    const lengthConfig = getResponseLengthConfig(conversationType);
    const personalityText = config.personality || currentPersonality;
    const systemMessage = buildSystemPrompt(
      personalityText,
      config.userEmotion,
      conversationType,
      config.backgroundStory
    );

    const contextMessages = messages
      .filter((msg) => msg.role !== 'system')
      .slice(-10)
      .map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

    const requestBody = {
      model,
      max_tokens: lengthConfig.maxTokens,
      system: systemMessage,
      messages: contextMessages,
      stop_sequences: ["用户:", "User:", "---"],
      stream: true, // Enable streaming
    };

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', CLAUDE_API_CONFIG.baseURL, true);
      xhr.responseType = 'text'; // Important for streaming

      // Set headers
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('x-api-key', apiKey);
      xhr.setRequestHeader('anthropic-version', CLAUDE_API_CONFIG.version);

      let fullText = '';
      let processedLength = 0;

      // Phase 3: Create SMART sentence buffer with intelligent filtering
      const smartBuffer = new SmartSentenceBuffer({
        conversationType,
        debug: true // Enable debug logging to see filtering decisions
      });

      // Track processed lines to avoid duplicates
      const processedLines = new Set<string>();

      // Handle streaming progress
      xhr.onprogress = () => {
        const responseText = xhr.responseText;

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
              // Phase 3: Use SmartSentenceBuffer to filter sentences
              const sentencesToPlay = smartBuffer.addChunk(text);

              // Only call onSentence for sentences that passed filtering
              for (const sentence of sentencesToPlay) {
                console.log(`[ChatAI] Phase 3: Playing filtered sentence: "${sentence}"`);
                onSentence(sentence);
                fullText += sentence;
              }
            }
          }
        }
      };

      // Handle completion
      xhr.onload = () => {
        if (xhr.status === 200) {
          try {
            // Phase 3: Flush remaining content from SmartBuffer
            const finalSentence = smartBuffer.flush();
            if (finalSentence) {
              console.log(`[ChatAI] Phase 3: Playing final sentence: "${finalSentence}"`);
              onSentence(finalSentence);
              fullText += finalSentence;
            }

            // Phase 3: Log statistics
            const stats = smartBuffer.getStats();
            console.log(`[ChatAI] Phase 3 Statistics:`, stats);
            console.log(`[ChatAI] Phase 3: Played ${stats.playedSentences}/${stats.totalSentences} sentences`);
            console.log(`[ChatAI] Phase 3: Skipped ${stats.skippedSentences} sentences`);
            console.log(`[ChatAI] Phase 3: Total length: ${stats.totalLength} chars`);
            console.log(`[ChatAI] Phase 3: Average importance: ${stats.averageImportance.toFixed(2)}`);

            // Validate and optimize final response (Layer 3 safety check)
            const optimizedResponse = validateAndOptimizeResponse(fullText, conversationType);
            resolve(optimizedResponse);
          } catch (error) {
            reject(new Error(`Response processing failed: ${error}`));
          }
        } else {
          reject(new Error(`${AI_ERROR_MESSAGES.API_CALL_FAILED}: ${xhr.status}`));
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
      };

      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);

      // Update proactive conversation timer
      lastUserMessageTime.current = Date.now();
      clearProactiveTimer();

      // Detect emotion and transition category
      const detectedEmotion = detectUserEmotion(content);
      const transitionCategory = detectTransitionCategory(
        content,
        detectedEmotion as Emotion
      );
      console.log(`[ChatAI] Phase 2: 过渡语音类别: ${transitionCategory}`);

      // Detect conversation type
      const conversationType = detectConversationType(content, updatedMessages);
      console.log(`[ChatAI] Phase 2: 对话类型检测: "${content}" -> ${conversationType}`);

      // Enhanced config with emotion
      const enhancedConfig = {
        ...config,
        userEmotion: config?.userEmotion || detectedEmotion,
      };

      // Initialize TTS queue (Phase 3: Store in ref for interruption)
      const voiceId = enhancedConfig?.voiceId || 'hkfHEbBvdQFNX4uWHqRF';
      const ttsQueue = new TTSQueue({
        voiceId,
        userEmotion: enhancedConfig?.userEmotion,
        // Phase 3: Callbacks for subtitle display
        onPlayStart: (text) => {
          setCurrentStreamSegment(text);
          if (!isStreamSpeaking) {
            setIsStreamSpeaking(true);
          }
        },
        onPlayEnd: (text) => {
          // Check if there are more items in queue
          const status = ttsQueue.getStatus();
          if (status.pending === 0 && status.ready === 0 && status.synthesizing === 0) {
            setCurrentStreamSegment('');
          }
        },
      });

      // Store current TTS queue for potential interruption
      currentTTSQueue.current = ttsQueue;

      let transitionAudioPlayed = false;
      let firstSentenceReceived = false;

      try {
        // Phase 2: Play transition audio immediately
        // NOTE: Disabled temporarily as it doesn't blend well with actual response
        // if (enhancedConfig?.enableTTS !== false) {
        //   console.log('[ChatAI] 🔊 Phase 2: 播放过渡语音');
        //   transitionAudio.playTransition(transitionCategory).catch((err) => {
        //     console.warn('[ChatAI] 过渡语音播放失败:', err);
        //   });
        //   transitionAudioPlayed = true;
        // }

        // Phase 3: Set generating state
        setIsStreamGenerating(true);

        // Stream API call with sentence-by-sentence TTS
        const aiResponse = await callClaudeAPIStreaming(
          updatedMessages,
          enhancedConfig,
          conversationType,
          async (sentence) => {
            // Phase 2: Stop transition audio on first sentence
            // NOTE: Disabled since transition audio is disabled
            // if (!firstSentenceReceived && transitionAudioPlayed) {
            //   console.log('[ChatAI] ⏸️ Phase 2: 停止过渡语音,开始真实回答');
            //   await transitionAudio.stop(); // Stop transition audio
            //   firstSentenceReceived = true;
            // }

            // Enqueue sentence for TTS
            if (enhancedConfig?.enableTTS !== false) {
              console.log(`[ChatAI] 🎵 Phase 2: 加入TTS队列: "${sentence}"`);
              await ttsQueue.enqueue(sentence);
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
        };

        setMessages([...updatedMessages, aiMessage]);

        // Wait for TTS queue to finish
        if (enhancedConfig?.enableTTS !== false) {
          console.log('[ChatAI] ⏳ Phase 2: 等待TTS队列完成');
          setIsStreamSpeaking(true); // Phase 3: Set speaking state
          await ttsQueue.waitForCompletion();
          setIsStreamSpeaking(false); // Phase 3: Clear speaking state
          console.log('[ChatAI] ✅ Phase 2: TTS队列播放完成');
        }

        // Start proactive conversation detection
        setTimeout(() => {
          startProactiveConversation();
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

        // Add error message
        const errorMessage: ChatMessage = {
          id: generateMessageId(),
          role: 'assistant',
          content: '抱歉，我现在无法回复。请稍后重试。',
          timestamp: Date.now(),
        };

        setMessages([...updatedMessages, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, currentPersonality, startProactiveConversation, clearProactiveTimer]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
    clearProactiveTimer();
    lastUserMessageTime.current = Date.now();
  }, [clearProactiveTimer]);

  const setPersonality = useCallback((personality: string) => {
    setCurrentPersonality(personality);
  }, []);

  /**
   * Stop all audio playback (Phase 3: Enhanced for user interruption)
   * Stops:
   * 1. Current TTS queue playback
   * 2. Transition audio
   * 3. Hybrid TTS playback (fallback)
   * 4. Clears all loading/generating/speaking states
   */
  const stopSpeaking = useCallback(async () => {
    console.log('[ChatAI] 🛑 User interruption - stopping all audio');

    // Phase 3: Clear ALL states (including isLoading)
    setIsLoading(false); // CRITICAL: Clear loading state to allow new messages
    setIsStreamGenerating(false);
    setIsStreamSpeaking(false);
    setCurrentStreamSegment('');

    // 1. Stop TTS queue if active
    if (currentTTSQueue.current) {
      try {
        await currentTTSQueue.current.cancel();
        console.log('[ChatAI] ✅ TTS queue cancelled');
      } catch (error) {
        console.error('[ChatAI] Error cancelling TTS queue:', error);
      }
      currentTTSQueue.current = null;
    }

    // 2. Stop transition audio if playing
    try {
      await transitionAudio.stop();
      console.log('[ChatAI] ✅ Transition audio stopped');
    } catch (error) {
      console.error('[ChatAI] Error stopping transition audio:', error);
    }

    // 3. Stop hybrid TTS (fallback, in case queue didn't work)
    try {
      stopTTS();
      console.log('[ChatAI] ✅ Hybrid TTS stopped');
    } catch (error) {
      console.error('[ChatAI] Error stopping hybrid TTS:', error);
    }
  }, [stopTTS]);

  const switchTTSProvider = useCallback((provider: TTSProvider) => {
    switchProvider(provider);
  }, [switchProvider]);

  const enableProactiveMode = useCallback((enabled: boolean) => {
    setIsProactiveModeEnabled(enabled);
    if (!enabled) {
      clearProactiveTimer();
    } else {
      // 如果启用且有消息，重新开始检测
      if (messages.length > 0) {
        setTimeout(() => {
          startProactiveConversation();
        }, 1000);
      }
    }
  }, [clearProactiveTimer, startProactiveConversation, messages.length]);

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      clearProactiveTimer();
    };
  }, [clearProactiveTimer]);

  // 当语音播放状态改变时，调整主动对话检测
  useEffect(() => {
    if (!isSpeaking && !isLoading && isProactiveModeEnabled && messages.length > 0) {
      setTimeout(() => {
        startProactiveConversation();
      }, 2000); // 语音结束后2秒开始检测
    } else if (isSpeaking || isLoading) {
      clearProactiveTimer();
    }
  }, [isSpeaking, isLoading, isProactiveModeEnabled, messages.length, startProactiveConversation, clearProactiveTimer]);

  // 合并错误信息
  const combinedError = error || ttsError;

  return {
    messages,
    isLoading,
    // Phase 3: Use streaming states instead of hybrid TTS states
    isSpeaking: isStreamSpeaking || isSpeaking, // Combine both for backward compatibility
    isGenerating: isStreamGenerating || isGenerating, // Combine both for backward compatibility
    error: combinedError,
    currentTTSProvider: currentProvider,
    sendMessage,
    clearMessages,
    setPersonality,
    stopSpeaking,
    switchTTSProvider,
    // Phase 3: Use streaming segment or fallback to hybrid TTS segment
    currentSegment: currentStreamSegment || currentSegment,
    enableProactiveMode,
    isProactiveModeEnabled,
  };
};
