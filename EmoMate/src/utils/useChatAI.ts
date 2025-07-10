import { useState, useCallback, useEffect, useRef } from 'react';
import { useHybridTTS, TTSProvider } from './useHybridTTS';
import { 
  CLAUDE_API_CONFIG, 
  getClaudeApiKey, 
  PERSONALITY_PROMPTS,
  AI_ERROR_MESSAGES,
  buildSystemPrompt,
  createPersonalitySystemPrompt,
  generateEmotionalResponsePrompt,
  validateAndOptimizeResponse,
  PROACTIVE_CONVERSATION_CONFIG,
  selectProactiveTopic
} from '../constants/ai';
import { AI_PERSONALITY } from '../constants/personality';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface ChatAIConfig {
  personality?: string;
  modelType?: 'haiku' | 'sonnet';
  apiKey?: string;
  enableTTS?: boolean; // 是否启用语音合成
  ttsProvider?: TTSProvider; // TTS 提供商选择
  voiceId?: string; // ElevenLabs 语音 ID
  userEmotion?: string; // 用户当前情绪状态
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
        const topic = selectProactiveTopic('short');
        sendProactiveMessage(topic);
        
        // 设置中等停顿检测
        proactiveTimer.current = setTimeout(() => {
          if (isProactiveModeEnabled) {
            const mediumTopic = selectProactiveTopic('medium');
            sendProactiveMessage(mediumTopic);
            
            // 设置长时间停顿检测
            proactiveTimer.current = setTimeout(() => {
              if (isProactiveModeEnabled) {
                const longTopic = selectProactiveTopic('long');
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

  const callClaudeAPI = async (
    messages: ChatMessage[],
    config: ChatAIConfig
  ): Promise<string> => {
    const apiKey = config.apiKey || getClaudeApiKey();
    if (!apiKey) {
      throw new Error(AI_ERROR_MESSAGES.API_KEY_MISSING);
    }

    const model = config.modelType
      ? CLAUDE_API_CONFIG.models[config.modelType]
      : CLAUDE_API_CONFIG.models[CLAUDE_API_CONFIG.defaultModel];

    // 构建API消息格式，包含人格和情绪信息
    const personalityText = config.personality || currentPersonality;
    const systemMessage = buildSystemPrompt(personalityText, config.userEmotion);
    const apiMessages = messages
      .filter((msg) => msg.role !== 'system')
      .map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

    const requestBody = {
      model,
      max_tokens: CLAUDE_API_CONFIG.maxTokens,
      system: systemMessage,
      messages: apiMessages,
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
    
    // 验证和优化回应格式
    return validateAndOptimizeResponse(rawResponse);
  };

  const sendMessage = useCallback(
    async (content: string, config?: ChatAIConfig) => {
      if (!content.trim()) return;

      setIsLoading(true);
      setError(null);

      // 添加用户消息
      const userMessage: ChatMessage = {
        id: generateMessageId(),
        role: 'user',
        content: content.trim(),
        timestamp: Date.now(),
      };

      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);

      // 更新最后用户消息时间并重启主动对话检测
      lastUserMessageTime.current = Date.now();
      clearProactiveTimer();

      try {
        // 检测用户情绪
        const detectedEmotion = detectUserEmotion(content);
        
        // 合并配置，包含情绪信息
        const enhancedConfig = {
          ...config,
          userEmotion: config?.userEmotion || detectedEmotion
        };

        // 调用Claude API
        const aiResponse = await callClaudeAPI(updatedMessages, enhancedConfig);

        // 添加AI回复
        const aiMessage: ChatMessage = {
          id: generateMessageId(),
          role: 'assistant',
          content: aiResponse,
          timestamp: Date.now(),
        };

        setMessages([...updatedMessages, aiMessage]);

        // 如果启用了 TTS，自动播放 AI 回复
        if (enhancedConfig?.enableTTS !== false) {
          // 默认启用，除非明确设为 false
          setTimeout(() => {
            // 使用角色设定中的默认语音ID
            const voiceId = enhancedConfig?.voiceId || 'hkfHEbBvdQFNX4uWHqRF';
            speak(aiResponse, voiceId, enhancedConfig?.userEmotion).catch(() => {
              // TTS error handled silently
            });
          }, 500); // 稍微延迟以确保消息已显示
        }

        // 启动主动对话检测
        setTimeout(() => {
          startProactiveConversation();
        }, 1000);
      } catch (err) {
        // API error handled below
        setError(err instanceof Error ? err.message : '发送消息失败');

        // 添加错误消息
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
    [messages, currentPersonality, speak]
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

  const stopSpeaking = useCallback(() => {
    stopTTS();
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
    isSpeaking,
    isGenerating,
    error: combinedError,
    currentTTSProvider: currentProvider,
    sendMessage,
    clearMessages,
    setPersonality,
    stopSpeaking,
    switchTTSProvider,
    currentSegment,
    enableProactiveMode,
    isProactiveModeEnabled,
  };
};
