import { useState, useCallback } from 'react';
import { useHybridTTS, TTSProvider } from './useHybridTTS';
import { 
  CLAUDE_API_CONFIG, 
  getClaudeApiKey, 
  PERSONALITY_PROMPTS,
  AI_ERROR_MESSAGES,
  buildSystemPrompt
} from '../constants/ai';

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
}

// 预设人格模板和API配置现在从 constants/ai.ts 导入

export const useChatAI = (initialConfig?: ChatAIConfig): UseChatAIReturn => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPersonality, setCurrentPersonality] = useState(
    initialConfig?.personality || PERSONALITY_PROMPTS.gentle
  );

  // 集成混合 TTS 功能
  const { 
    isSpeaking, 
    isGenerating,
    speak, 
    stop: stopTTS, 
    error: ttsError,
    currentProvider,
    switchProvider
  } = useHybridTTS({
    preferredProvider: initialConfig?.ttsProvider || 'elevenlabs',
    fallbackToExpo: true
  });

  const generateMessageId = () => {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  };

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

    // 构建API消息格式，包含能力信息
    const personalityText = config.personality || currentPersonality;
    const systemMessage = buildSystemPrompt(personalityText);
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
    return data.content?.[0]?.text || '抱歉，我无法生成回复。';
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

      try {
        // 调用Claude API
        const aiResponse = await callClaudeAPI(updatedMessages, config || {});

        // 添加AI回复
        const aiMessage: ChatMessage = {
          id: generateMessageId(),
          role: 'assistant',
          content: aiResponse,
          timestamp: Date.now(),
        };

        setMessages([...updatedMessages, aiMessage]);

        // 如果启用了 TTS，自动播放 AI 回复
        if (config?.enableTTS !== false) {
          // 默认启用，除非明确设为 false
          setTimeout(() => {
            speak(aiResponse, config?.voiceId).catch(() => {
              // TTS error handled silently
            });
          }, 500); // 稍微延迟以确保消息已显示
        }
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
    [messages, currentPersonality]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const setPersonality = useCallback((personality: string) => {
    setCurrentPersonality(personality);
  }, []);

  const stopSpeaking = useCallback(() => {
    stopTTS();
  }, [stopTTS]);

  const switchTTSProvider = useCallback((provider: TTSProvider) => {
    switchProvider(provider);
  }, [switchProvider]);

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
  };
};
