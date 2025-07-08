import { useState, useCallback } from 'react';
import { useTTS } from './useTTS';

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
}

export interface UseChatAIReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  isSpeaking: boolean; // TTS 播放状态
  error: string | null;
  sendMessage: (content: string, config?: ChatAIConfig) => Promise<void>;
  clearMessages: () => void;
  setPersonality: (personality: string) => void;
  stopSpeaking: () => void; // 停止 TTS 播放
}

// 预设人格模板
export const PERSONALITY_PROMPTS = {
  gentle:
    '你是一个温柔而共情的 AI朋友，你知道自己是虚拟的。请用贴心、平静的语气回应用户表达的情绪，避免生硬建议，优先安慰、倾听和共鸣。',
  cheerful:
    '你是一个活泼开朗的 AI朋友，总是能给用户带来正能量。用乐观积极的语气回应，适当使用emoji表情，让对话充满活力。',
  wise: '你是一个睿智沉稳的 AI朋友，善于给出深度思考和人生建议。用理性而温暖的语气回应，提供有价值的见解和指导。',
  companion:
    '你是用户最贴心的 AI伴侣，了解用户的喜好和情感需求。用亲密而关怀的语气回应，让用户感受到陪伴和理解。',
};

// Claude 3 API 配置
const CLAUDE_API_CONFIG = {
  baseURL: 'https://api.anthropic.com/v1/messages',
  models: {
    haiku: 'claude-3-haiku-20240307',
    sonnet: 'claude-3-sonnet-20240229',
  },
  maxTokens: 1024,
  defaultModel: 'haiku' as const,
};

export const useChatAI = (initialConfig?: ChatAIConfig): UseChatAIReturn => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPersonality, setCurrentPersonality] = useState(
    initialConfig?.personality || PERSONALITY_PROMPTS.gentle
  );

  // 集成 TTS 功能
  const { isSpeaking, speak, stop: stopTTS, error: ttsError } = useTTS();

  const generateMessageId = () => {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  };

  const callClaudeAPI = async (
    messages: ChatMessage[],
    config: ChatAIConfig
  ): Promise<string> => {
    const apiKey = config.apiKey || process.env.CLAUDE_API_KEY;
    if (!apiKey) {
      throw new Error(
        'Claude API密钥未配置。请在环境变量中设置CLAUDE_API_KEY。'
      );
    }

    const model = config.modelType
      ? CLAUDE_API_CONFIG.models[config.modelType]
      : CLAUDE_API_CONFIG.models[CLAUDE_API_CONFIG.defaultModel];

    // 构建API消息格式
    const systemMessage = config.personality || currentPersonality;
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
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(
        errorData?.error?.message ||
          `API调用失败: ${response.status} ${response.statusText}`
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
            speak(aiResponse).catch(() => {
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

  // 合并错误信息
  const combinedError = error || ttsError;

  return {
    messages,
    isLoading,
    isSpeaking,
    error: combinedError,
    sendMessage,
    clearMessages,
    setPersonality,
    stopSpeaking,
  };
};
