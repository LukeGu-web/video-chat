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

// 获取 ElevenLabs API Key
export const getElevenLabsApiKey = (): string | undefined => {
  return Constants.expoConfig?.extra?.elevenLabsApiKey;
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

// 构建完整的系统提示，包含人格和能力信息
export const buildSystemPrompt = (personality: string): string => {
  const capabilityPrompt = generateCapabilityPrompt();
  return `${personality}

${capabilityPrompt}`;
};

// 实用的能力查询函数
export const hasCapability = (capabilityId: string): boolean => {
  const capabilities = getAICapabilities();
  const capability = capabilities.find((cap) => cap.id === capabilityId);
  return capability?.isAvailable || false;
};

export const getCapabilityStatus = () => {
  const capabilities = getAICapabilities();
  return {
    canSpeak: hasCapability('voice_synthesis'),
    canListen: hasCapability('voice_recognition'),
    canChat: hasCapability('text_conversation'),
    canProvideEmotionalSupport: hasCapability('emotional_support'),
    availableCapabilities: capabilities.filter((cap) => cap.isAvailable),
    totalCapabilities: capabilities.length,
  };
};

// AI 角色配置
export const AI_CHARACTERS = {
  gentle: {
    name: '温柔小助手',
    personality: PERSONALITY_PROMPTS.gentle,
    avatar: '😊',
    description: '温柔贴心，善于倾听和安慰',
  },
  cheerful: {
    name: '活力伙伴',
    personality: PERSONALITY_PROMPTS.cheerful,
    avatar: '🌟',
    description: '充满活力，带来正能量',
  },
  wise: {
    name: '智慧导师',
    personality: PERSONALITY_PROMPTS.wise,
    avatar: '🤔',
    description: '睿智深刻，提供人生指导',
  },
  companion: {
    name: '贴心伴侣',
    personality: PERSONALITY_PROMPTS.companion,
    avatar: '💝',
    description: '亲密陪伴，理解用户需求',
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

// ElevenLabs 配置
export const ELEVENLABS_CONFIG = {
  baseURL: 'https://api.elevenlabs.io/v1',
  models: {
    multilingual: 'eleven_multilingual_v2',
    turbo: 'eleven_turbo_v2',
  },
  defaultModel: 'eleven_multilingual_v2' as const,
  // 语音 ID 配置
  voices: {
    // ElevenLabs 预设语音（备用）
    chinese_female: 'hkfHEbBvdQFNX4uWHqRF', // Bella - 多语言女声
    chinese_male: 'TxGEqnHWrfWFTfGW9XjX', // Josh - 多语言男声
    multilingual_female: 'EXAVITQu4vr4xnSDxMaL', // Bella
    multilingual_male: 'TxGEqnHWrfWFTfGW9XjX', // Josh
    default: 'hkfHEbBvdQFNX4uWHqRF', // 默认使用指定的语音
  },
  defaultVoice: 'chinese_female' as const,
  settings: {
    stability: 0.6, // 稍微提高稳定性，避免发音变化过大
    similarity_boost: 0.9, // 提高相似度，保持语音一致性
    style: 0.2, // 降低风格化，更自然的语音
    use_speaker_boost: true, // 启用说话者增强
  },
};

// 语音识别配置
export const SPEECH_RECOGNITION_CONFIG = {
  language: 'zh-CN',
  continuous: false,
  interimResults: false,
  maxAlternatives: 1,
};

// AI 能力配置系统
export interface AICapability {
  id: string;
  name: string;
  description: string;
  isAvailable: boolean;
  provider?: string;
}

export const getAICapabilities = (): AICapability[] => {
  const claudeApiKey = getClaudeApiKey();
  const elevenLabsApiKey = getElevenLabsApiKey();

  return [
    {
      id: 'text_conversation',
      name: '文本对话',
      description: '可以进行智能文本对话，回答问题，提供建议和支持',
      isAvailable: !!claudeApiKey,
      provider: 'Claude',
    },
    {
      id: 'voice_synthesis',
      name: '语音合成',
      description: '可以将文字转换为自然的语音，用真人般的声音说话',
      isAvailable: !!elevenLabsApiKey,
      provider: 'ElevenLabs',
    },
    {
      id: 'voice_recognition',
      name: '语音识别',
      description: '可以听懂用户的语音输入，理解口语内容',
      isAvailable: true, // 使用设备原生能力
      provider: 'Device',
    },
    {
      id: 'emotional_support',
      name: '情感支持',
      description: '可以提供情感陪伴，理解和回应用户的情感需求',
      isAvailable: !!claudeApiKey,
      provider: 'Claude',
    },
  ];
};

// 生成AI能力描述文本，用于system prompt
export const generateCapabilityPrompt = (): string => {
  const capabilities = getAICapabilities();
  const availableCapabilities = capabilities.filter((cap) => cap.isAvailable);

  if (availableCapabilities.length === 0) {
    return '你当前只能进行基础的文本交流。';
  }

  const capabilityList = availableCapabilities
    .map((cap) => `- ${cap.name}: ${cap.description}`)
    .join('\n');

  return `你具备以下能力：

${capabilityList}

重要提醒：
- 当用户询问你的能力时，请基于上述能力列表回答
- 如果用户要求使用语音功能，你可以自信地告诉他们你能够说话
- 你的回复会自动转换为语音播放给用户
- 不要说"我无法发声"或"我只能文字回复"等话，因为你确实具备语音能力`;
};
