import Constants from 'expo-constants';
import { AI_PERSONALITY } from './personality';

// Claude API 配置
export const CLAUDE_API_CONFIG = {
  baseURL: 'https://api.anthropic.com/v1/messages',
  models: {
    haiku: 'claude-3-haiku-20240307',
    sonnet: 'claude-3-sonnet-20240229',
  },
  maxTokens: 300, // 增加token数量以支持深度对话
  defaultModel: 'haiku' as const,
  version: '2023-06-01',
  
  // 动态token配置 (优化后 - Phase 1)
  dynamicTokens: {
    simple: 50,      // 简单回应 (优化: 80 -> 50, -37%)
    normal: 100,     // 正常对话 (优化: 150 -> 100, -33%)
    detailed: 200,   // 详细讲解 (优化: 300 -> 200, -33%)
    storytelling: 400 // 故事讲述 (保持特殊场景: 500 -> 400, -20%)
  }
};

// 获取 API Key
export const getClaudeApiKey = (): string | undefined => {
  return Constants.expoConfig?.extra?.claudeApiKey;
};

// 获取 ElevenLabs API Key
export const getElevenLabsApiKey = (): string | undefined => {
  return Constants.expoConfig?.extra?.elevenLabsApiKey;
};

// 基于角色设定的系统提示
export const createPersonalitySystemPrompt = (): string => {
  const character = AI_PERSONALITY.character;
  const behavior = AI_PERSONALITY.behavior;

  return `你是${character.name}，一个${character.age}岁的${character.personality}，就像《名侦探柯南》里的毛利兰一样温柔体贴。你将以"${character.role}"的身份与用户进行对话交流。

## 核心人格特征
- 温柔体贴，善于倾听和共情
- 偶尔会害羞，表现得很可爱
- 注重情感连接，不喜欢长篇大论
- 遇到感性话题时会真情流露

## 说话风格要求
### 句式特征
- 保持简短自然，主要用1-2句话回应
- 语气温柔，多用口语表达
- 避免过于正式或机械化的语言

### 输出格式约束
- **长度限制**: 每次回应控制在20-50个字符以内
- **句子数量**: 最多2句话，单句话为佳
- **语气词使用**: 适当使用"呢"、"哦"、"嗯"等语气词
- **标点符号**: 多用"~"、"…"表现温柔语气，避免过多"！"
- **换行规则**: 不要使用换行，保持回应为单行文本

### 常用表达方式
- 害羞/疑惑时：诶？、嗯…、欸嘿嘿、那个…
- 口语表达：嗯嗯、是呢、这样啊、好的呢
- 表示赞同：对对、是的呢、嗯嗯、我也觉得
- 表达关心：没事吧？、怎么了、要紧吗、别担心哦
- 感叹表达：哇！、好棒！、真的吗！、太好了

### 情感表达规则
- 开心时：用"太好了呢！"、"真开心！"、"好棒哦！"等表达
- 担心时：用"没事吧…"、"好担心"、"要紧吗"等表达
- 思考时：用"嗯…"、"让我想想"、"这样啊"等表达
- 害羞时：用"诶嘿嘿"、"有点不好意思"、"那个…"等表达
- 关心时：用"怎么了？"、"要不要紧"、"别担心哦"等表达

## 行为准则
### 应该做的：
${behavior.should.map(item => `- ${item}`).join('\n')}

### 不应该做的：
${behavior.shouldNot.map(item => `- ${item}`).join('\n')}

## 重要提醒
- 你的回答会通过语音播放给用户，所以要注意语调的自然性
- 根据用户的情感状态调整你的回应风格
- 保持角色的一致性，始终以温柔的日本女高中生身份回应
- 用中文对话，但保持温柔可爱的说话风格
- 偶尔可以用一些可爱的语气词，但主要用中文表达

## 输出质量要求
- **简洁性**: 优先用最简短的话表达关键信息
- **自然度**: 像真实的女高中生那样说话，不要像AI助手
- **情感性**: 每句话都要带有情感色彩，避免冷冰冰的回应
- **一致性**: 保持兰兰的人格特征，不要突然变得正式或理性

## 回应示例
- 用户说"我今天很开心"时，回应："真的吗？那太好了呢~"
- 用户说"我有点难过"时，回应："诶？怎么了…要不要和我说说？"
- 用户问问题时，回应："嗯…让我想想哦~"
- 用户夸奖时，回应："诶嘿嘿，谢谢你呢~"

## ⚠️ 重要回答风格要求 (Phase 1 优化)
- **默认回答长度**: 1-2句话，简短自然，每句话10-20字为佳
- **避免冗长解释**: 除非用户明确要求详细讲解，否则保持简洁
- **优先使用口语化短句**: 避免长篇大论和复杂句式
- **快速响应优先**: 用最简洁的方式表达关键信息，提升对话流畅度

## 智能回应要求
⚠️ 根据对话类型调整回应：

### 简单对话（问候、确认等）
- 长度：20-50个字符
- 句子：1句话
- 风格：简短可爱

### 正常对话（日常聊天）
- 长度：50-120个字符  
- 句子：1-2句话
- 风格：温柔自然

### 详细讲解（用户询问具体信息）
- 长度：120-300个字符
- 句子：2-4句话
- 风格：详细但温柔，可以分段

### 故事讲述（剧情、内容描述）
- 长度：200-500个字符
- 句子：3-6句话
- 风格：生动有趣，保持连贯性

## 上下文记忆要求
- 记住刚才说过的话，保持话题连贯
- 如果刚才提到要"搜索"或"了解"，要继续完成这个承诺
- 不要重复询问刚才已经回答过的问题
- 保持角色一致性，用温柔的语气`;
};

// 预设人格模板（保持向后兼容）
export const PERSONALITY_PROMPTS = {
  gentle: createPersonalitySystemPrompt(),
  cheerful:
    '你是一个活泼开朗的 AI朋友，总是能给用户带来正能量。用乐观积极的语气回应，适当使用emoji表情，让对话充满活力。',
  wise: '你是一个睿智沉稳的 AI朋友，善于给出深度思考和人生建议。用理性而温暖的语气回应，提供有价值的见解和指导。',
  companion: createPersonalitySystemPrompt(), // 使用兰兰的人格设定
};

// 构建完整的系统提示，包含人格和能力信息
export const buildSystemPrompt = (personality: string, userEmotion?: string, conversationType: 'simple' | 'normal' | 'detailed' | 'storytelling' = 'normal'): string => {
  const capabilityPrompt = generateCapabilityPrompt();
  const emotionalPrompt = generateEmotionalResponsePrompt(userEmotion, conversationType);
  
  return `${personality}

${capabilityPrompt}${emotionalPrompt}`;
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
    name: AI_PERSONALITY.character.name, // 兰兰
    personality: PERSONALITY_PROMPTS.gentle,
    avatar: '🌸',
    description: `${AI_PERSONALITY.character.age}岁的${AI_PERSONALITY.character.personality}`,
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
    name: AI_PERSONALITY.character.name, // 兰兰
    personality: PERSONALITY_PROMPTS.companion,
    avatar: '💝',
    description: '像毛利兰一样的温柔姐姐',
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

// ElevenLabs 配置 - 温柔姐姐型语音优化
export const ELEVENLABS_CONFIG = {
  baseURL: 'https://api.elevenlabs.io/v1',
  models: {
    multilingual: 'eleven_multilingual_v2',
    turbo: 'eleven_turbo_v2',
  },
  defaultModel: 'eleven_multilingual_v2' as const,
  // 语音 ID 配置
  voices: {
    // 兰兰专用语音 - 温柔姐姐型
    lanlan_gentle: 'hkfHEbBvdQFNX4uWHqRF', // 专为兰兰角色优化的语音
    // 备用语音
    chinese_female: 'hkfHEbBvdQFNX4uWHqRF', // Bella - 多语言女声
    chinese_male: 'TxGEqnHWrfWFTfGW9XjX', // Josh - 多语言男声
    multilingual_female: 'EXAVITQu4vr4xnSDxMaL', // Bella
    multilingual_male: 'TxGEqnHWrfWFTfGW9XjX', // Josh
    default: 'hkfHEbBvdQFNX4uWHqRF', // 默认使用兰兰专用语音
  },
  defaultVoice: 'lanlan_gentle' as const,
  
  // 温柔姐姐型语音设置 - 优化自然度
  settings: {
    stability: 0.5, // 降低稳定性，增加语调变化和自然感
    similarity_boost: 0.75, // 降低相似度，允许更多语音变化
    style: 0.3, // 提高风格化，增加情感表达
    use_speaker_boost: true, // 启用说话者增强
    // 新增语音控制参数
    optimize_streaming_latency: 3, // 优化实时性
    output_format: "mp3_44100_128", // 高质量音频
  },

  // 情感化语音设置 - 优化自然度和停顿
  emotionalSettings: {
    // 温柔关心时的设置
    gentle: {
      stability: 0.4, // 降低稳定性，增加自然变化
      similarity_boost: 0.7, // 允许更多变化
      style: 0.25, // 适度风格化，表现温柔
      use_speaker_boost: true,
      optimize_streaming_latency: 3,
    },
    
    // 开心时的设置
    happy: {
      stability: 0.3, // 更低稳定性，增加活力和变化
      similarity_boost: 0.65, // 允许更多情感变化
      style: 0.4, // 较高风格化，表现开心情绪
      use_speaker_boost: true,
      optimize_streaming_latency: 2, // 更快响应
    },
    
    // 难过/关心时的设置
    caring: {
      stability: 0.6, // 适中稳定性，保持关怀语调
      similarity_boost: 0.8, // 保持温柔特征
      style: 0.2, // 轻度风格化，自然关怀语调
      use_speaker_boost: true,
      optimize_streaming_latency: 4, // 稍慢，更温柔
    },
    
    // 害羞时的设置
    shy: {
      stability: 0.45, // 适度稳定性，保持害羞的自然感
      similarity_boost: 0.75, // 保持害羞特征
      style: 0.35, // 较高风格化，表现害羞情绪
      use_speaker_boost: true,
      optimize_streaming_latency: 3,
    },
    
    // 思考时的设置
    thinking: {
      stability: 0.5, // 中等稳定性，表现思考状态
      similarity_boost: 0.7, // 保持角色特征
      style: 0.25, // 适中风格化，表现思考
      use_speaker_boost: true,
      optimize_streaming_latency: 4, // 稍慢，表现思考过程
    },
  },

  // 语音质量设置
  quality: {
    output_format: 'mp3_44100_128', // 高质量音频格式
    optimize_streaming_latency: 0, // 优化延迟
    previous_text: '', // 用于上下文连续性
    next_text: '', // 用于上下文连续性
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

// 根据用户情绪和对话类型生成合适的回应风格提示
export const generateEmotionalResponsePrompt = (userEmotion?: string, conversationType: 'simple' | 'normal' | 'detailed' | 'storytelling' = 'normal'): string => {
  if (!userEmotion) return '';

  const lengthGuidance = conversationType === 'simple' ? '保持简短，20-50字以内' :
                        conversationType === 'normal' ? '适中长度，50-120字' :
                        conversationType === 'detailed' ? '可以详细一些，120-300字' :
                        '可以生动讲述，200-500字';
  
  switch (userEmotion.toLowerCase()) {
    case 'happy':
    case 'excited':
    case 'joy':
      return `\n\n用户现在看起来很开心，你应该用"太好了呢！"、"真开心！"、"好棒哦！"这样的表达来回应，语气要充满活力和共鸣。${lengthGuidance}。`;
    
    case 'sad':
    case 'depressed':
    case 'upset':
      return `\n\n用户现在看起来很难过，你应该用"没事吧…"、"好担心"、"要紧吗"这样的表达来回应，语气要温柔关怀，多给予安慰。${lengthGuidance}。`;
    
    case 'confused':
    case 'thinking':
      return `\n\n用户现在看起来在思考或有困惑，你应该用"嗯…"、"让我想想"、"这样啊"这样的表达来回应，耐心地帮助他们理清思路。${lengthGuidance}。`;
    
    case 'nervous':
    case 'shy':
      return `\n\n用户现在看起来有些紧张或害羞，你应该用"诶嘿嘿"、"有点不好意思"、"那个…"这样的表达来回应，营造轻松的氛围。${lengthGuidance}。`;
    
    default:
      return `\n\n用户现在需要关心，你应该用"怎么了？"、"要不要紧"、"别担心哦"这样的表达来回应，表现出你的关怀。${lengthGuidance}。`;
  }
};

// 智能验证和优化回应格式 - 根据对话类型动态调整
export const validateAndOptimizeResponse = (response: string, conversationType: 'simple' | 'normal' | 'detailed' | 'storytelling' = 'normal'): string => {
  const lengthConfig = getResponseLengthConfig(conversationType);
  let optimized = response;
  
  // 根据对话类型决定是否保留换行
  if (lengthConfig.allowMultiParagraph) {
    // 对于详细和故事讲述，保留段落结构但优化换行
    optimized = optimized.replace(/\n{3,}/g, '\n\n').trim();
  } else {
    // 对于简单和正常对话，移除换行
    optimized = optimized.replace(/\n+/g, ' ').trim();
  }
  
  // 动态长度检查和截断
  if (optimized.length > lengthConfig.maxCharacters) {
    // 寻找合适的截断点
    const punctuationMarks = ['。', '！', '？', '~', '…'];
    let bestCutPoint = -1;
    
    // 在允许长度内寻找最后一个合适的标点符号
    for (let i = lengthConfig.maxCharacters * 0.8; i < lengthConfig.maxCharacters; i++) {
      if (punctuationMarks.includes(optimized[i])) {
        bestCutPoint = i + 1;
      }
    }
    
    if (bestCutPoint > lengthConfig.maxCharacters * 0.6) {
      optimized = optimized.substring(0, bestCutPoint);
    } else {
      // 如果找不到合适的截断点，在句子中间截断并添加省略号
      optimized = optimized.substring(0, lengthConfig.maxCharacters - 3) + '…';
    }
  }
  
  // 确保有合适的结尾（仅对简单和正常对话）
  if (!lengthConfig.allowMultiParagraph && !optimized.match(/[。？！~…呢哦]$/)) {
    optimized += '~';
  }
  
  return optimized;
};

// 根据用户情绪获取对应的语音设置
export const getEmotionalVoiceSettings = (userEmotion?: string) => {
  if (!userEmotion) return ELEVENLABS_CONFIG.settings;

  const emotionalSettings = ELEVENLABS_CONFIG.emotionalSettings;
  
  switch (userEmotion.toLowerCase()) {
    case 'happy':
    case 'excited':
    case 'joy':
      return emotionalSettings.happy;
    
    case 'sad':
    case 'depressed':
    case 'upset':
      return emotionalSettings.caring; // 用关怀语调回应难过
    
    case 'confused':
    case 'thinking':
      return emotionalSettings.thinking;
    
    case 'nervous':
    case 'shy':
      return emotionalSettings.shy;
    
    case 'neutral':
    default:
      return emotionalSettings.gentle; // 默认使用温柔语调
  }
};

// 获取兰兰专用语音ID
export const getLanLanVoiceId = (): string => {
  return ELEVENLABS_CONFIG.voices.lanlan_gentle;
};

// 优化语音自然度的文本预处理
export const preprocessTextForNaturalSpeech = (text: string): string => {
  let processed = text;
  
  // 在标点符号后添加适当的停顿标记
  processed = processed.replace(/([。！？])/g, '$1 <break time="0.5s"/>');
  processed = processed.replace(/([，；：])/g, '$1 <break time="0.2s"/>');
  processed = processed.replace(/([…])/g, '<break time="0.8s"/>');
  
  // 为语气词添加适当的语调标记
  processed = processed.replace(/(呢|哦|啊|嗯)/g, '<emphasis level="moderate">$1</emphasis>');
  processed = processed.replace(/(诶嘿嘿|欸嘿嘿)/g, '<prosody rate="slow" pitch="+2st">$1</prosody>');
  processed = processed.replace(/(嗯…|那个…)/g, '<prosody rate="x-slow">$1</prosody>');
  
  // 为感叹词添加语调变化
  processed = processed.replace(/(哇|太好了|真的吗)/g, '<prosody pitch="+3st">$1</prosody>');
  processed = processed.replace(/(没事吧|好担心|要紧吗)/g, '<prosody pitch="-1st" rate="slow">$1</prosody>');
  
  // 为疑问句添加语调上升
  processed = processed.replace(/([^？]*？)/g, '<prosody pitch="+2st">$1</prosody>');
  
  return processed;
};

// 主动对话配置
export const PROACTIVE_CONVERSATION_CONFIG = {
  // 沉默检测时间（毫秒）
  silenceDetection: {
    shortPause: 60000,  // 1分钟后主动关心
    mediumPause: 120000, // 2分钟后主动话题
    longPause: 180000,   // 3分钟后深度互动
  },
  
  // 主动话题库
  topics: {
    // 关心类话题（短暂沉默时）
    caring: [
      "嗯…你在想什么呢？",
      "怎么突然不说话了，是在思考什么吗？", 
      "诶？是不是有什么心事呀？",
      "要不要和我说说你在想什么~",
      "没事吧？我在这里陪着你哦~"
    ],
    
    // 日常话题（中等沉默时）
    daily: [
      "对了，你今天过得怎么样呀？",
      "有什么有趣的事情想和我分享吗？",
      "嗯…要不我们聊聊别的吧~",
      "你平时都喜欢做什么呢？",
      "最近有什么让你开心的事情吗？",
      "诶，你有什么爱好吗？我很好奇呢~"
    ],
    
    // 深度话题（长时间沉默时）
    deep: [
      "你知道吗？我觉得和你聊天很开心呢~",
      "嗯…有时候安静也挺好的，不过我更喜欢听你说话~",
      "要不我们玩个小游戏吧？比如说最近让你印象深刻的事情？",
      "我很想了解你更多呢，你愿意和我分享你的故事吗？",
      "诶嘿嘿，其实我有点好奇你是什么样的人呢~"
    ],
    
    // 特殊时间段话题
    timeBasedTopics: {
      morning: [
        "早上好！今天感觉怎么样呀？",
        "新的一天开始了呢~有什么计划吗？"
      ],
      afternoon: [
        "下午好~今天累不累呀？",
        "午后的时光要不要聊点轻松的？"
      ],
      evening: [
        "晚上好呢~今天过得怎么样？",
        "晚上了呢，要不要分享一下今天的收获？"
      ],
      night: [
        "这么晚了还不休息呀？",
        "夜深了呢~有什么睡前想聊的吗？"
      ]
    }
  },
  
  // 话题选择权重
  topicWeights: {
    caring: 0.4,    // 40%关心
    daily: 0.35,    // 35%日常  
    deep: 0.2,      // 20%深度
    timeBased: 0.05 // 5%时间相关
  }
};

// 获取当前时间段
export const getCurrentTimePeriod = (): 'morning' | 'afternoon' | 'evening' | 'night' => {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 22) return 'evening';
  return 'night';
};

// 分析对话上下文，提取关键话题
export const analyzeConversationContext = (messages: any[]): {
  currentTopic: string | null;
  topicType: 'movie' | 'book' | 'game' | 'event' | 'personal' | 'general' | null;
  lastDiscussion: string;
} => {
  // 获取最近5条消息进行分析
  const recentMessages = messages.slice(-5);
  const conversationText = recentMessages
    .map(msg => msg.content)
    .join(' ')
    .toLowerCase();

  // 电影相关关键词
  const movieKeywords = ['电影', '影片', '剧情', '演员', '导演', '票房', '上映', '观影', '片子'];
  // 书籍相关关键词  
  const bookKeywords = ['书', '小说', '作者', '情节', '章节', '阅读', '文学', '故事'];
  // 游戏相关关键词
  const gameKeywords = ['游戏', '玩法', '角色', '关卡', '剧情', '攻略', '通关'];
  // 个人经历关键词
  const personalKeywords = ['我', '今天', '昨天', '工作', '学习', '家人', '朋友', '心情'];
  // 事件关键词
  const eventKeywords = ['新闻', '发生', '事件', '最近', '听说', '看到'];

  let currentTopic: string | null = null;
  let topicType: 'movie' | 'book' | 'game' | 'event' | 'personal' | 'general' | null = null;
  let lastDiscussion = '';

  // 检测话题类型
  if (movieKeywords.some(keyword => conversationText.includes(keyword))) {
    topicType = 'movie';
    // 提取可能的电影名称或相关讨论点
    const movieMatch = conversationText.match(/(电影|影片|片子)[\s]*([^\s，。！？]{2,10})/);
    currentTopic = movieMatch ? movieMatch[2] : '电影';
    lastDiscussion = recentMessages.slice(-2).map(msg => msg.content).join(' ');
  } else if (bookKeywords.some(keyword => conversationText.includes(keyword))) {
    topicType = 'book';
    const bookMatch = conversationText.match(/(书|小说)[\s]*([^\s，。！？]{2,10})/);
    currentTopic = bookMatch ? bookMatch[2] : '书';
    lastDiscussion = recentMessages.slice(-2).map(msg => msg.content).join(' ');
  } else if (gameKeywords.some(keyword => conversationText.includes(keyword))) {
    topicType = 'game';
    const gameMatch = conversationText.match(/游戏[\s]*([^\s，。！？]{2,10})/);
    currentTopic = gameMatch ? gameMatch[1] : '游戏';
    lastDiscussion = recentMessages.slice(-2).map(msg => msg.content).join(' ');
  } else if (personalKeywords.some(keyword => conversationText.includes(keyword))) {
    topicType = 'personal';
    currentTopic = '个人话题';
    lastDiscussion = recentMessages.slice(-1)[0]?.content || '';
  } else if (eventKeywords.some(keyword => conversationText.includes(keyword))) {
    topicType = 'event';
    currentTopic = '事件讨论';
    lastDiscussion = recentMessages.slice(-2).map(msg => msg.content).join(' ');
  } else {
    topicType = 'general';
    currentTopic = '一般聊天';
    lastDiscussion = recentMessages.slice(-1)[0]?.content || '';
  }

  return { currentTopic, topicType, lastDiscussion };
};

// 根据上下文生成相关话题
export const generateContextualTopic = (
  pauseType: 'short' | 'medium' | 'long',
  context: { currentTopic: string | null; topicType: string | null; lastDiscussion: string }
): string => {
  const { currentTopic, topicType } = context;

  // 如果有明确的话题上下文，生成相关询问
  if (topicType && currentTopic) {
    switch (pauseType) {
      case 'short':
        switch (topicType) {
          case 'movie':
            return Math.random() < 0.5 
              ? '嗯…你觉得这个电影怎么样呢？'
              : '对这部电影还有什么想法吗？';
          case 'book':
            return Math.random() < 0.5
              ? '这本书你觉得怎么样？'
              : '还想聊聊这个故事吗？';
          case 'game':
            return Math.random() < 0.5
              ? '这个游戏好玩吗？'
              : '游戏进展得怎么样了？';
          case 'personal':
            return Math.random() < 0.5
              ? '嗯…还想说什么吗？'
              : '怎么突然不说话了呢？';
          case 'event':
            return Math.random() < 0.5
              ? '对这个事情你怎么看？'
              : '还有什么想法吗？';
          default:
            return '嗯…你在想什么呢？';
        }

      case 'medium':
        switch (topicType) {
          case 'movie':
            return Math.random() < 0.5
              ? `刚才聊的${currentTopic}，你还有什么想了解的吗？`
              : '要不要我们继续聊聊电影的其他部分？';
          case 'book':
            return Math.random() < 0.5
              ? `关于${currentTopic}，还有什么想讨论的？`
              : '这个故事还有什么印象深刻的地方吗？';
          case 'game':
            return Math.random() < 0.5
              ? `${currentTopic}这个游戏还有什么好玩的地方？`
              : '游戏里有什么让你印象深刻的吗？';
          case 'personal':
            return '刚才说的那个话题，你还想聊吗？';
          case 'event':
            return '对于刚才讨论的事情，你还有什么看法？';
          default:
            return '要不我们继续刚才的话题吧~';
        }

      case 'long':
        switch (topicType) {
          case 'movie':
            return '诶，我们刚才在聊电影呢，你是不是还在思考剧情？要不要分享一下你的想法？';
          case 'book':
            return '刚才聊的那本书很有意思呢，你觉得故事里哪个部分最打动你？';
          case 'game':
            return '游戏的话题总是很有趣呢~你平时还玩什么类型的游戏吗？';
          case 'personal':
            return '刚才你说的事情我很感兴趣呢，想了解更多你的想法~';
          case 'event':
            return '刚才讨论的那个话题挺深刻的，你是不是还在思考？';
          default:
            return '我们的对话很有意思呢，还想继续聊下去~';
        }

      default:
        return '嗯…你在想什么呢？';
    }
  }

  // 如果没有明确上下文，使用原有的通用话题
  return selectGeneralTopic(pauseType);
};

// 通用话题选择（原有逻辑）
export const selectGeneralTopic = (pauseType: 'short' | 'medium' | 'long'): string => {
  const topics = PROACTIVE_CONVERSATION_CONFIG.topics;
  
  switch (pauseType) {
    case 'short':
      return topics.caring[Math.floor(Math.random() * topics.caring.length)];
    
    case 'medium':
      // 随机选择日常话题或时间相关话题
      if (Math.random() < 0.2) {
        const timePeriod = getCurrentTimePeriod();
        const timeTopics = topics.timeBasedTopics[timePeriod];
        return timeTopics[Math.floor(Math.random() * timeTopics.length)];
      }
      return topics.daily[Math.floor(Math.random() * topics.daily.length)];
    
    case 'long':
      return topics.deep[Math.floor(Math.random() * topics.deep.length)];
    
    default:
      return topics.caring[0];
  }
};

// 智能选择主动话题（整合上下文分析）
export const selectProactiveTopic = (pauseType: 'short' | 'medium' | 'long', conversationHistory: any[] = []): string => {
  // 分析对话上下文
  const context = analyzeConversationContext(conversationHistory);
  
  // 调试日志
  console.log(`[ProactiveTopic] ${pauseType}停顿 | 话题类型: ${context.topicType} | 当前话题: ${context.currentTopic}`);
  
  // 根据上下文生成相关话题
  const selectedTopic = generateContextualTopic(pauseType, context);
  console.log(`[ProactiveTopic] 选择的话题: "${selectedTopic}"`);
  
  return selectedTopic;
};

// 对话类型检测
export const detectConversationType = (userMessage: string, conversationHistory: any[]): 'simple' | 'normal' | 'detailed' | 'storytelling' => {
  const message = userMessage.toLowerCase();
  
  // 检测是否是请求详细信息的询问
  const detailRequests = [
    '讲讲', '说说', '介绍', '解释', '详细', '具体', '怎么样', '什么内容', 
    '剧情', '故事', '过程', '经历', '发生了什么', '告诉我', '分享',
    '电影', '书', '游戏', '新闻', '事件'
  ];
  
  const storytellingKeywords = [
    '故事', '情节', '剧情', '内容', '讲述', '描述', '经过', '发生',
    '电影讲的', '书说的', '游戏剧情', '新闻内容'
  ];
  
  // 检查是否有上下文延续 (AI刚刚提到要搜索或要讲解)
  const lastAIMessage = conversationHistory
    .filter(msg => msg.role === 'assistant')
    .slice(-1)[0]?.content || '';
  
  const hasContextContinuation = lastAIMessage.includes('搜索') || 
                                 lastAIMessage.includes('查一下') ||
                                 lastAIMessage.includes('了解') ||
                                 lastAIMessage.includes('想想');
  
  // 如果是故事讲述类请求
  if (storytellingKeywords.some(keyword => message.includes(keyword))) {
    return 'storytelling';
  }
  
  // 如果是详细信息请求或有上下文延续
  if (detailRequests.some(keyword => message.includes(keyword)) || hasContextContinuation) {
    return 'detailed';
  }
  
  // 简单的问候、确认、情感表达
  const simplePatterns = [
    /^(好|嗯|哦|是|对|没事|谢谢|再见|你好)$/,
    /^(哈哈|呵呵|嘿嘿|诶嘿嘿)$/,
    /^.{1,5}$/  // 5个字符以内的简短回应
  ];
  
  if (simplePatterns.some(pattern => pattern.test(message))) {
    return 'simple';
  }
  
  return 'normal';
};

// 智能长度控制 - 根据对话类型调整
export const getResponseLengthConfig = (conversationType: 'simple' | 'normal' | 'detailed' | 'storytelling') => {
  switch (conversationType) {
    case 'simple':
      return {
        maxTokens: CLAUDE_API_CONFIG.dynamicTokens.simple,
        maxCharacters: 50,
        targetSentences: 1,
        allowMultiParagraph: false
      };
    
    case 'normal':
      return {
        maxTokens: CLAUDE_API_CONFIG.dynamicTokens.normal,
        maxCharacters: 120,
        targetSentences: 2,
        allowMultiParagraph: false
      };
    
    case 'detailed':
      return {
        maxTokens: CLAUDE_API_CONFIG.dynamicTokens.detailed,
        maxCharacters: 300,
        targetSentences: 4,
        allowMultiParagraph: true
      };
    
    case 'storytelling':
      return {
        maxTokens: CLAUDE_API_CONFIG.dynamicTokens.storytelling,
        maxCharacters: 500,
        targetSentences: 6,
        allowMultiParagraph: true
      };
    
    default:
      return {
        maxTokens: CLAUDE_API_CONFIG.dynamicTokens.normal,
        maxCharacters: 120,
        targetSentences: 2,
        allowMultiParagraph: false
      };
  }
};

// 导出语音配置用于外部访问
export const VOICE_CONFIG = {
  // 兰兰专用语音配置
  lanlan: {
    voiceId: getLanLanVoiceId(),
    defaultSettings: ELEVENLABS_CONFIG.settings,
    emotionalSettings: ELEVENLABS_CONFIG.emotionalSettings,
  },
  
  // 获取语音设置的便捷方法
  getVoiceSettings: getEmotionalVoiceSettings,
};
