import Constants from 'expo-constants';

// Claude API 配置
export const CLAUDE_API_CONFIG = {
  baseURL: 'https://api.anthropic.com/v1/messages',
  models: {
    haiku: 'claude-3-haiku-20240307',
    sonnet: 'claude-3-sonnet-20240229',
  },
  maxTokens: 1024,
  defaultModel: 'haiku' as const,
  version: '2023-06-01',
};

// 获取 API Key
export const getClaudeApiKey = (): string | undefined => {
  return Constants.expoConfig?.extra?.claudeApiKey;
};

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

// AI 角色配置
export const AI_CHARACTERS = {
  gentle: {
    name: '温柔小助手',
    personality: PERSONALITY_PROMPTS.gentle,
    avatar: '😊',
    description: '温柔贴心，善于倾听和安慰'
  },
  cheerful: {
    name: '活力伙伴',
    personality: PERSONALITY_PROMPTS.cheerful,
    avatar: '🌟',
    description: '充满活力，带来正能量'
  },
  wise: {
    name: '智慧导师',
    personality: PERSONALITY_PROMPTS.wise,
    avatar: '🤔',
    description: '睿智深刻，提供人生指导'
  },
  companion: {
    name: '贴心伴侣',
    personality: PERSONALITY_PROMPTS.companion,
    avatar: '💝',
    description: '亲密陪伴，理解用户需求'
  },
};

// 错误消息
export const AI_ERROR_MESSAGES = {
  API_KEY_MISSING: 'Claude API密钥未配置。请在环境变量中设置CLAUDE_API_KEY。',
  API_CALL_FAILED: 'API调用失败',
  NETWORK_ERROR: '网络连接异常，请检查网络后重试',
  RATE_LIMIT: 'API调用频率过高，请稍后重试',
  UNKNOWN_ERROR: '发生未知错误，请重试',
};

// TTS 配置
export const TTS_CONFIG = {
  defaultRate: 0.8,
  defaultPitch: 1.0,
  defaultVolume: 1.0,
  language: 'zh-CN',
};

// 语音识别配置
export const SPEECH_RECOGNITION_CONFIG = {
  language: 'zh-CN',
  continuous: false,
  interimResults: false,
  maxAlternatives: 1,
};