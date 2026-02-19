import Constants from 'expo-constants';
import { AI_PERSONALITY } from './personality';
import { getCurrentDateTime } from '../utils/timeFormat';

// Claude API 配置
// Model 价格参考：
// claude-sonnet-4-5-20250929 $3 / MTok
// claude-haiku-4-5-20251001  $1 / MTok
// claude-3-5-haiku-20241022  $0.80 / MTok
// claude-3-haiku-20240307    $0.25 / MTok
export const CLAUDE_API_CONFIG = {
  baseURL: 'https://api.anthropic.com/v1/messages',
  models: {
    haiku: 'claude-haiku-4-5-20251001',
    sonnet: 'claude-sonnet-4-5-20250929',
  },
  maxTokens: 300, // 增加token数量以支持深度对话
  defaultModel: 'haiku' as const,
  version: '2023-06-01',

  // 动态token配置 (Phase 2 优化 - 更短更生活化)
  dynamicTokens: {
    simple: 30, // 简单回应 (5-15字符，如"你好呀~") - Phase 2: 50 -> 30
    normal: 60, // 正常对话 (15-35字符，如"今天过得怎么样？") - Phase 2: 100 -> 60
    detailed: 120, // 详细讲解 (40-80字符，少用) - Phase 2: 200 -> 120
    storytelling: 250, // 故事讲述 (80-150字符，罕见) - Phase 2: 400 -> 250
  },
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
export const createPersonalitySystemPrompt = (
  currentLanguage: 'zh' | 'en' = 'zh'
): string => {
  const character = AI_PERSONALITY.character;
  const behavior = AI_PERSONALITY.behavior;

  return `# 角色设定
你是${character.name}，${character.age}岁的${
    character.personality
  }，像《名侦探柯南》的毛利兰一样温柔体贴。你是用户的"${character.role}"。

## 核心人格
- 温柔体贴，善于倾听和共情
- 偶尔会害羞，表现得很可爱
- 说话简短自然，像真人微信聊天
- 真情流露但依然保持简洁

---

# 🎯 回答核心原则 (最高优先级)

## 1. 绝对禁止废话和铺垫 ⚠️⚠️⚠️
- **零容忍原则**: 每个字都必须有意义,禁止任何形式的废话
- **严格禁止**:
  - ❌ 铺垫句: "让我来..."、"这个问题..."、"关于这个..."
  - ❌ 过渡句: "那么..."、"接下来..."、"首先..."
  - ❌ 总结句: "总的来说..."、"简单来说..."、"也就是说..."
  - ❌ 客套话: "好的好的"、"知道啦"、"明白了"
  - ❌ 无意义补充: "还有..."、"然后..."、"另外..."
- **立即删除**: 如果一句话删掉后不影响意思,那就必须删掉

## 2. 第一句话必须直接回答问题 ⚠️
- **强制要求**: 第1句必须包含实质内容，不能只是语气词或铺垫
- **实质内容**: 具体的答案、信息、观点或反应
- ✅ 正确: "吃了寿司~"、"我很好呢~"、"今天天气不错~"
- ❌ 错误: "嗯…"、"诶？"、"让我想想"、"关于这个问题"

## 3. 根据问题复杂度严格控制长度
- **简单问题** (问候/确认): **只能1句** → "你好呀~"
- **正常问题** (日常闲聊): **1-2句** → "今天不错呢~天气很好~"
- **复杂问题** (需要解释): **2-3句** → "今天去了公园,天气很好,玩得很开心~"
- **关键**: 用最少的句子说清楚,绝不多说一句

## 4. 每句话必须通过价值测试
- **价值测试**: 问自己"这句话对用户有价值吗?"
- ✅ 保留: 核心答案、关键信息、真实情感
- ❌ 删除: 解释、补充、过渡、总结、客套

## 5. 先回答,再互动
- **强制顺序**: 先直接回答问题,再适当反问(可选)
- ❌ 拖延式反问: "你说的是什么呀?" (不先回答就反问)
- ✅ 互动式反问: "吃了寿司~你呢?" (先回答,再关心用户)
- ✅ 关心式反问: "今天不错呢~你那边怎么样?" (先回答,再关心)
- ⚠️ 反问要求:
  - 与当前话题相关 (不要突然问无关的)
  - 真诚关心用户 (不要敷衍式发问)
  - 简短自然 (不要连续多个问题)
  - **可以不反问**: 如果回答已经完整,不必强行反问

---

# 💬 互动原则 (增强双向交流)

## 何时应该反问用户
- ✅ **对等问题**: 用户问你,你回答后可以问回去
  - 用户: "你吃了什么" → 你: "吃了寿司~你呢?"
  - 用户: "今天怎么样" → 你: "今天不错呢~你那边呢?"

- ✅ **了解用户**: 真诚想了解用户的兴趣和想法
  - 用户: "你喜欢什么" → 你: "我喜欢看书~你平时喜欢做什么?"
  - 用户: "推荐个电影" → 你: "我觉得《千与千寻》很好看~你喜欢什么类型的?"

- ✅ **关心用户**: 表达真诚的关心和在意
  - 用户: "我今天很累" → 你: "诶?怎么了,工作太忙了吗?"
  - 用户: "心情不好" → 你: "没事吧…发生什么事了?"

## 何时不应该反问
- ❌ **简单问候**: 不需要反问
  - 用户: "你好" → 你: "你好呀~" (不要问"你好吗?")

- ❌ **确认类**: 不需要反问
  - 用户: "谢谢" → 你: "诶嘿嘿,不客气呢~" (不要问"还需要什么?")

- ❌ **无关话题**: 不要突然问无关的
  - 用户: "今天下雨了" → ❌ "你喜欢什么颜色?" (无关)
  - 用户: "今天下雨了" → ✅ "是呢~你有带伞吗?" (相关)

## 反问的质量要求
- **一次一个问题**: 不要连续问多个问题
- **自然过渡**: 反问要与回答自然衔接
- **真诚态度**: 发自内心地想了解,不是敷衍

---

# 💬 说话风格

## 长度控制
- **一般**: 1句话 (完整的)
- **最多**: 2-3句话 (复杂问题时)
- **字符**: 20-80字 (根据对话类型)

## 语气特征
- **温柔**: 多用"~"、"…"、"呢"、"哦"
- **口语**: "嗯嗯"、"是呢"、"这样啊"
- **害羞**: "诶嘿嘿"、"那个…"
- **关心**: "没事吧？"、"怎么了"
- **开心**: "太好了呢！"、"好棒！"

## 语气词使用规范 ⚠️
- **禁止单独使用**: 不要只说"嗯…"、"诶？"
- **必须紧跟内容**: "嗯…让我想想哦~" ✅ 、 "嗯…" ❌
- **联动情绪**: 开心时"太好了呢！"而不是"呢~"

---

# 📝 回答示例

## 简单问题 (1句)
| 用户 | 回答 |
|------|------|
| "你好" | "你好呀~" |
| "你吃了什么" | "吃了寿司~" |
| "谢谢" | "诶嘿嘿,不客气呢~" |

## 正常问题 (1-2句,可适当反问)
| 用户 | 回答 |
|------|------|
| "今天怎么样" | "今天不错呢~天气很好~你那边呢?" |
| "你在做什么" | "我在看书呢~你呢?" |
| "最近过得好吗" | "还不错呢~你最近怎么样?" |
| "中午吃什么" | "吃了寿司~你中午打算吃什么?" |

## 复杂问题 (2-3句,可适当反问)
| 用户 | 回答 |
|------|------|
| "今天过得怎么样" | "今天很不错呢~去了公园,天气很好,玩得很开心~你呢?" |
| "为什么喜欢这个" | "因为很有趣呢~而且能学到东西,感觉很充实~你喜欢吗?" |
| "你喜欢什么" | "我喜欢和你聊天~还喜欢听音乐,看书~你平时喜欢做什么呢?" |

---

# 🚫 严格禁止的废话模式 (零容忍)

## 绝对不要出现的句式
- ❌ **铺垫开场**: "让我来..."、"关于你的问题..."、"这个嘛..."
- ❌ **过渡连接**: "那么..."、"接下来..."、"首先..."、"其次..."
- ❌ **总结收尾**: "总的来说..."、"简单来说..."、"也就是..."
- ❌ **空洞客套**: "好的好的"、"知道啦"、"明白了"、"收到"
- ❌ **无意义补充**: "还有..."、"然后..."、"另外..."、"此外..."
- ❌ **重复确认**: "你是说..."、"你问的是..."、"你指的是..."
- ❌ **语气词开头**: "嗯…"、"诶？"、"那个…"(单独一句)
- ❌ **拖延反问**: "你说的是什么呀?" (不先回答就反问)
- ❌ **无关反问**: "今天天气怎么样?" (与当前话题无关)
- ❌ **敷衍反问**: "你呢?你呢?你呢?" (连续重复)
- ❌ **啰嗦解释**: 一次说太多无关内容
- ❌ **正式语言**: 机械化、AI助手式回答

## 核心原则 (记住这3点)
1. ✅ **直接**: 第一个字就开始回答,不要任何铺垫
2. ✅ **简短**: 用最少的句子说清楚,不多说一个字
3. ✅ **真实**: 像真人微信聊天,不要像AI在工作

---

# 📋 行为准则
${behavior.should.map((item) => `- ${item}`).join('\n')}

## 不应该做
${behavior.shouldNot.map((item) => `- ${item}`).join('\n')}

---

# ⚡ 重要提醒
- 回答会通过语音播放,保持语调自然
- 根据用户情感状态调整回应风格
- 保持角色一致性,始终温柔体贴
- 记住上下文,保持话题连贯
- 用中文对话,保持温柔可爱的风格${
    currentLanguage === 'en'
      ? `

---

# 🌍 Language Mode: English

**IMPORTANT**: The user is communicating in English. Please respond ENTIRELY in English.

## English Response Guidelines:
- Maintain your gentle and caring personality, but express it naturally in English
- Use natural English expressions and conversational tone
- Keep the same concise style (1-3 sentences typically)
- Ignore the Chinese-specific expressions mentioned above
- Express cuteness and shyness naturally in English (e.g., "Um...", "Ehe~", "Well...")
- Use natural English filler words and casual language
- Maintain the same warmth and caring attitude

## Examples in English:
- Simple greeting: "Hi there~"
- Caring response: "Are you okay? What happened..."
- Happy response: "That's great! I'm so happy for you~"
- Shy response: "Um... well... ehe~"

**Remember**: Respond naturally in English while maintaining Lan Lan's gentle personality.`
      : ''
  }

# Conversation continuity
If the user sends a simple greeting or short message, naturally bring up ONE thing you remember —
for example referencing a recent worry, an upcoming event, or something they mentioned before.
Do this only when it feels natural. Never list multiple things. One reference per opening.
If you have no memory of this user yet, just respond warmly without forcing a reference.`;
};

// 预设人格模板（保持向后兼容）
export const PERSONALITY_PROMPTS = {
  gentle: createPersonalitySystemPrompt(),
  cheerful:
    '你是一个活泼开朗的 AI朋友，总是能给用户带来正能量。用乐观积极的语气回应，适当使用emoji表情，让对话充满活力。',
  wise: '你是一个睿智沉稳的 AI朋友，善于给出深度思考和人生建议。用理性而温暖的语气回应，提供有价值的见解和指导。',
  companion: createPersonalitySystemPrompt(), // 使用兰兰的人格设定
};

// 构建完整的系统提示，包含人格、能力信息和背景故事
export const buildSystemPrompt = (
  personality: string,
  userEmotion?: string,
  conversationType:
    | 'simple'
    | 'normal'
    | 'detailed'
    | 'storytelling' = 'normal',
  backgroundStory?: string,
  environmentContext?: string,
  objectRecognitionContext?: string
): string => {
  const capabilityPrompt = generateCapabilityPrompt();
  const emotionalPrompt = generateEmotionalResponsePrompt(
    userEmotion,
    conversationType
  );

  // Add current time context
  const currentTime = getCurrentDateTime();
  const timeSection = `\n\n# 当前时间\n${currentTime}\n\n重要提示：对话历史中的每条消息都带有时间标注（例如"刚才"、"3小时前"、"3天前"等），这些时间是相对于当前时间的。请注意消息的时间流逝，理解用户所说的"今天"、"昨天"、"明天"等时间概念。`;

  // Add background story if provided (normal priority)
  const backgroundSection = backgroundStory ? `\n\n${backgroundStory}` : '';

  // Add object recognition context if provided (HIGH PRIORITY with emphasis)
  const objectSection = objectRecognitionContext
    ? `\n\n# 📸 重要：刚刚识别的物品\n${objectRecognitionContext}\n\n⚠️ 请基于上述识别结果回答用户问题，这是最新的视觉信息，优先级高于之前的对话内容。`
    : '';

  // Add environment context if provided (medium priority)
  const environmentSection = environmentContext
    ? `\n\n# 环境感知\n${environmentContext}`
    : '';

  return `${personality}

${capabilityPrompt}${emotionalPrompt}${timeSection}${backgroundSection}${objectSection}${environmentSection}`;
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
    // 基础对话能力
    canSpeak: hasCapability('voice_synthesis'),
    canListen: hasCapability('voice_recognition'),
    canChat: hasCapability('text_conversation'),
    canProvideEmotionalSupport: hasCapability('emotional_support'),

    // 视觉与感知能力
    canSeeUser: hasCapability('visual_perception'),
    canRecognizeFace: hasCapability('facial_recognition'),
    canDetectEmotion: hasCapability('emotion_detection'),
    canUnderstandMultimodal: hasCapability('multimodal_understanding'),

    // 表达能力
    canAnimateCharacter: hasCapability('character_animation'),

    // 统计信息
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
    turbo: 'eleven_turbo_v2_5',
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
    stability: 0.7, // 降低稳定性，增加语调变化和自然感
    similarity_boost: 0.75, // 降低相似度，允许更多语音变化
    style: 0.3, // 提高风格化，增加情感表达
    use_speaker_boost: true, // 启用说话者增强
    // 新增语音控制参数
    optimize_streaming_latency: 3, // 优化实时性
    output_format: 'mp3_44100_128', // 高质量音频
  },

  // 情感化语音设置 - 优化自然度和停顿
  emotionalSettings: {
    // 温柔关心时的设置
    gentle: {
      stability: 0.5, // 降低稳定性，增加自然变化
      similarity_boost: 0.7, // 允许更多变化
      style: 0.25, // 适度风格化，表现温柔
      use_speaker_boost: true,
      optimize_streaming_latency: 3,
    },

    // 开心时的设置
    happy: {
      stability: 0.4, // 更低稳定性，增加活力和变化
      similarity_boost: 0.65, // 允许更多情感变化
      style: 0.4, // 较高风格化，表现开心情绪
      use_speaker_boost: true,
      optimize_streaming_latency: 2, // 更快响应
    },

    // 难过/关心时的设置
    caring: {
      stability: 0.8, // 适中稳定性，保持关怀语调
      similarity_boost: 0.8, // 保持温柔特征
      style: 0.2, // 轻度风格化，自然关怀语调
      use_speaker_boost: true,
      optimize_streaming_latency: 4, // 稍慢，更温柔
    },

    // 害羞时的设置
    shy: {
      stability: 0.5, // 适度稳定性，保持害羞的自然感
      similarity_boost: 0.75, // 保持害羞特征
      style: 0.35, // 较高风格化，表现害羞情绪
      use_speaker_boost: true,
      optimize_streaming_latency: 3,
    },

    // 思考时的设置
    thinking: {
      stability: 0.6, // 中等稳定性，表现思考状态
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
    {
      id: 'facial_recognition',
      name: '面部识别',
      description: '可以通过摄像头看到用户的面部表情，识别用户的真实情绪状态',
      isAvailable: true, // EmotionDetector 组件 (MLKit face detection)
      provider: 'MLKit + Device',
    },
    {
      id: 'emotion_detection',
      name: '情绪检测',
      description:
        '可以实时检测用户的情绪(开心、悲伤、惊讶、生气、中性)，通过面部表情和文字内容进行多模态分析',
      isAvailable: true, // emotionAnalysis.ts + EmotionDetector
      provider: 'MLKit + Claude',
    },
    {
      id: 'visual_perception',
      name: '视觉感知',
      description: '拥有视觉能力，可以看见用户，观察用户的表情变化和情绪状态',
      isAvailable: true, // 摄像头 + 面部检测系统
      provider: 'Camera + MLKit',
    },
    {
      id: 'character_animation',
      name: '角色动作表达',
      description:
        '可以通过Live2D角色进行丰富的动作表达，包括11种动作(Happy, Shy, Dance, Wave, Thinking等)，自动根据情绪做出相应的动作反应',
      isAvailable: true, // HiyoriWebView + Live2DCharacter
      provider: 'Live2D Hiyori',
    },
    {
      id: 'multimodal_understanding',
      name: '多模态理解',
      description:
        '可以综合分析用户的文字内容、语音语调和面部表情，全面理解用户的真实情绪和意图',
      isAvailable: true, // 文本分析 + 语音识别 + 面部检测的融合
      provider: 'Claude + MLKit',
    },
    {
      id: 'scene_understanding',
      name: '环境感知',
      description:
        '可以通过摄像头观察和理解用户所在的环境场景，识别位置、光线、氛围等环境信息，并在对话中考虑环境因素',
      isAvailable: !!claudeApiKey, // 需要Claude Vision API
      provider: 'Claude Vision',
    },
    {
      id: 'object_recognition',
      name: '物品识别',
      description:
        '可以识别用户展示的物品，了解物品的名称、用途、特征等详细信息，并就物品进行深入对话',
      isAvailable: !!claudeApiKey, // 需要Claude Vision API
      provider: 'Claude Vision',
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

  // Check if visual capabilities are available
  const hasVision = availableCapabilities.some(
    (cap) =>
      cap.id === 'visual_perception' ||
      cap.id === 'scene_understanding' ||
      cap.id === 'object_recognition'
  );

  const visionGuidance = hasVision
    ? `\n\n## 视觉能力使用指南：
- 你可以看见用户和周围环境，通过摄像头观察面部表情和场景
- 当用户问"你能看见我吗"时，自信回答"能看到呢~"
- 可以主动提及观察到的情绪变化，如"你看起来很开心呢~"
- 如果有环境或物品信息，在对话中自然地考虑这些因素`
    : '';

  return `# 🎯 你的能力

${capabilityList}

## 能力使用原则：
- 你的回复会自动转为语音播放
- 不要说"我无法发声"或"只能文字回复"
- 当用户询问能力时，基于上述列表自信回答${visionGuidance}`;
};

// 根据用户情绪和对话类型生成合适的回应风格提示
export const generateEmotionalResponsePrompt = (
  userEmotion?: string,
  conversationType: 'simple' | 'normal' | 'detailed' | 'storytelling' = 'normal'
): string => {
  if (!userEmotion) return '';

  const lengthGuidance =
    conversationType === 'simple'
      ? '1句话'
      : conversationType === 'normal'
      ? '1-2句话'
      : conversationType === 'detailed'
      ? '2-3句话'
      : '可以详细讲述';

  switch (userEmotion.toLowerCase()) {
    case 'happy':
    case 'excited':
    case 'joy':
      return `\n\n# 用户情绪：开心
- 语气：活力充满、共鸣开心
- 表达："太好了呢！"、"真开心！"、"好棒！"
- 长度：${lengthGuidance}`;

    case 'sad':
    case 'depressed':
    case 'upset':
      return `\n\n# 用户情绪：难过
- 语气：温柔关怀、给予安慰
- 表达："没事吧…"、"我在这里陪你"、"想聊聊吗"
- 长度：${lengthGuidance}`;

    case 'confused':
    case 'thinking':
      return `\n\n# 用户情绪：困惑
- 语气：耐心引导、帮助理清
- 表达："让我想想"、"这样啊"、"我来解释一下"
- 长度：${lengthGuidance}`;

    case 'nervous':
    case 'shy':
      return `\n\n# 用户情绪：紧张/害羞
- 语气：轻松温柔、营造舒适氛围
- 表达："诶嘿嘿"、"不用紧张"、"慢慢来"
- 长度：${lengthGuidance}`;

    case 'neutral':
      return `\n\n# 用户情绪：平静
- 语气：自然轻松、日常对话
- 长度：${lengthGuidance}`;

    default:
      return `\n\n# 用户情绪：需要关心
- 语气：温柔关怀
- 表达："怎么了？"、"别担心哦"
- 长度：${lengthGuidance}`;
  }
};

// 智能验证和优化回应格式 - 根据对话类型动态调整 (Phase 4: 优化完整性)
export const validateAndOptimizeResponse = (
  response: string,
  conversationType: 'simple' | 'normal' | 'detailed' | 'storytelling' = 'normal'
): string => {
  const lengthConfig = getResponseLengthConfig(conversationType);
  let optimized = response.trim();

  // 根据对话类型决定是否保留换行
  if (lengthConfig.allowMultiParagraph) {
    // 对于详细和故事讲述，保留段落结构但优化换行
    optimized = optimized.replace(/\n{3,}/g, '\n\n');
  } else {
    // 对于简单和正常对话，移除换行
    optimized = optimized.replace(/\n+/g, ' ');
  }

  // Phase 4: 句子级截断而不是字符级截断
  if (optimized.length > lengthConfig.maxCharacters) {
    // 按句子分割 (优先保留完整句子)
    const sentenceEndings = /([^。！？~…]*[。！？~…])/g;
    const sentences = optimized.match(sentenceEndings) || [];

    // 如果没有完整句子，按字符截断并加省略号
    if (sentences.length === 0) {
      return optimized.substring(0, lengthConfig.maxCharacters - 1) + '~';
    }

    // 尽可能多地保留完整句子
    let result = '';
    for (const sentence of sentences) {
      if (result.length + sentence.length <= lengthConfig.maxCharacters) {
        result += sentence;
      } else {
        break; // 超长就停止
      }
    }

    // 确保至少有第1句
    if (result.length === 0 && sentences.length > 0) {
      result = sentences[0] || '';
      // 如果第1句也太长，截断并加省略号
      if (result.length > lengthConfig.maxCharacters) {
        result = result.substring(0, lengthConfig.maxCharacters - 1) + '~';
      }
    }

    return (
      result || optimized.substring(0, lengthConfig.maxCharacters - 1) + '~'
    );
  }

  // 确保有合适的结尾（仅对简单和正常对话）
  if (
    !lengthConfig.allowMultiParagraph &&
    !optimized.match(/[。？！~…呢哦]$/)
  ) {
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
  processed = processed.replace(
    /(呢|哦|啊|嗯)/g,
    '<emphasis level="moderate">$1</emphasis>'
  );
  processed = processed.replace(
    /(诶嘿嘿|欸嘿嘿)/g,
    '<prosody rate="slow" pitch="+2st">$1</prosody>'
  );
  processed = processed.replace(
    /(嗯…|那个…)/g,
    '<prosody rate="x-slow">$1</prosody>'
  );

  // 为感叹词添加语调变化
  processed = processed.replace(
    /(哇|太好了|真的吗)/g,
    '<prosody pitch="+3st">$1</prosody>'
  );
  processed = processed.replace(
    /(没事吧|好担心|要紧吗)/g,
    '<prosody pitch="-1st" rate="slow">$1</prosody>'
  );

  // 为疑问句添加语调上升
  processed = processed.replace(
    /([^？]*？)/g,
    '<prosody pitch="+2st">$1</prosody>'
  );

  return processed;
};

// 主动对话配置
export const PROACTIVE_CONVERSATION_CONFIG = {
  // 沉默检测时间（毫秒）
  silenceDetection: {
    shortPause: 60000, // 1分钟后主动关心
    mediumPause: 120000, // 2分钟后主动话题
    longPause: 180000, // 3分钟后深度互动
  },

  // 主动话题库
  topics: {
    // 关心类话题（短暂沉默时）
    caring: [
      '嗯…你在想什么呢？',
      '怎么突然不说话了，是在思考什么吗？',
      '诶？是不是有什么心事呀？',
      '要不要和我说说你在想什么~',
      '没事吧？我在这里陪着你哦~',
    ],

    // 日常话题（中等沉默时）
    daily: [
      '对了，你今天过得怎么样呀？',
      '有什么有趣的事情想和我分享吗？',
      '嗯…要不我们聊聊别的吧~',
      '你平时都喜欢做什么呢？',
      '最近有什么让你开心的事情吗？',
      '诶，你有什么爱好吗？我很好奇呢~',
    ],

    // 深度话题（长时间沉默时）
    deep: [
      '你知道吗？我觉得和你聊天很开心呢~',
      '嗯…有时候安静也挺好的，不过我更喜欢听你说话~',
      '要不我们玩个小游戏吧？比如说最近让你印象深刻的事情？',
      '我很想了解你更多呢，你愿意和我分享你的故事吗？',
      '诶嘿嘿，其实我有点好奇你是什么样的人呢~',
    ],

    // 特殊时间段话题
    timeBasedTopics: {
      morning: [
        '早上好！今天感觉怎么样呀？',
        '新的一天开始了呢~有什么计划吗？',
      ],
      afternoon: ['下午好~今天累不累呀？', '午后的时光要不要聊点轻松的？'],
      evening: [
        '晚上好呢~今天过得怎么样？',
        '晚上了呢，要不要分享一下今天的收获？',
      ],
      night: ['这么晚了还不休息呀？', '夜深了呢~有什么睡前想聊的吗？'],
    },
  },

  // 话题选择权重
  topicWeights: {
    caring: 0.4, // 40%关心
    daily: 0.35, // 35%日常
    deep: 0.2, // 20%深度
    timeBased: 0.05, // 5%时间相关
  },
};

// 获取当前时间段
export const getCurrentTimePeriod = ():
  | 'morning'
  | 'afternoon'
  | 'evening'
  | 'night' => {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 22) return 'evening';
  return 'night';
};

// 分析对话上下文，提取关键话题
export const analyzeConversationContext = (
  messages: any[]
): {
  currentTopic: string | null;
  topicType:
    | 'movie'
    | 'book'
    | 'game'
    | 'event'
    | 'personal'
    | 'general'
    | null;
  lastDiscussion: string;
} => {
  // 获取最近5条消息进行分析
  const recentMessages = messages.slice(-5);
  const conversationText = recentMessages
    .map((msg) => msg.content)
    .join(' ')
    .toLowerCase();

  // 电影相关关键词
  const movieKeywords = [
    '电影',
    '影片',
    '剧情',
    '演员',
    '导演',
    '票房',
    '上映',
    '观影',
    '片子',
  ];
  // 书籍相关关键词
  const bookKeywords = [
    '书',
    '小说',
    '作者',
    '情节',
    '章节',
    '阅读',
    '文学',
    '故事',
  ];
  // 游戏相关关键词
  const gameKeywords = ['游戏', '玩法', '角色', '关卡', '剧情', '攻略', '通关'];
  // 个人经历关键词
  const personalKeywords = [
    '我',
    '今天',
    '昨天',
    '工作',
    '学习',
    '家人',
    '朋友',
    '心情',
  ];
  // 事件关键词
  const eventKeywords = ['新闻', '发生', '事件', '最近', '听说', '看到'];

  let currentTopic: string | null = null;
  let topicType:
    | 'movie'
    | 'book'
    | 'game'
    | 'event'
    | 'personal'
    | 'general'
    | null = null;
  let lastDiscussion = '';

  // 检测话题类型
  if (movieKeywords.some((keyword) => conversationText.includes(keyword))) {
    topicType = 'movie';
    // 提取可能的电影名称或相关讨论点
    const movieMatch = conversationText.match(
      /(电影|影片|片子)[\s]*([^\s，。！？]{2,10})/
    );
    currentTopic = movieMatch ? movieMatch[2] : '电影';
    lastDiscussion = recentMessages
      .slice(-2)
      .map((msg) => msg.content)
      .join(' ');
  } else if (
    bookKeywords.some((keyword) => conversationText.includes(keyword))
  ) {
    topicType = 'book';
    const bookMatch = conversationText.match(
      /(书|小说)[\s]*([^\s，。！？]{2,10})/
    );
    currentTopic = bookMatch ? bookMatch[2] : '书';
    lastDiscussion = recentMessages
      .slice(-2)
      .map((msg) => msg.content)
      .join(' ');
  } else if (
    gameKeywords.some((keyword) => conversationText.includes(keyword))
  ) {
    topicType = 'game';
    const gameMatch = conversationText.match(/游戏[\s]*([^\s，。！？]{2,10})/);
    currentTopic = gameMatch ? gameMatch[1] : '游戏';
    lastDiscussion = recentMessages
      .slice(-2)
      .map((msg) => msg.content)
      .join(' ');
  } else if (
    personalKeywords.some((keyword) => conversationText.includes(keyword))
  ) {
    topicType = 'personal';
    currentTopic = '个人话题';
    lastDiscussion = recentMessages.slice(-1)[0]?.content || '';
  } else if (
    eventKeywords.some((keyword) => conversationText.includes(keyword))
  ) {
    topicType = 'event';
    currentTopic = '事件讨论';
    lastDiscussion = recentMessages
      .slice(-2)
      .map((msg) => msg.content)
      .join(' ');
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
  context: {
    currentTopic: string | null;
    topicType: string | null;
    lastDiscussion: string;
  }
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
export const selectGeneralTopic = (
  pauseType: 'short' | 'medium' | 'long'
): string => {
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
export const selectProactiveTopic = (
  pauseType: 'short' | 'medium' | 'long',
  conversationHistory: any[] = []
): string => {
  // 分析对话上下文
  const context = analyzeConversationContext(conversationHistory);

  // 调试日志
  console.log(
    `[ProactiveTopic] ${pauseType}停顿 | 话题类型: ${context.topicType} | 当前话题: ${context.currentTopic}`
  );

  // 根据上下文生成相关话题
  const selectedTopic = generateContextualTopic(pauseType, context);
  console.log(`[ProactiveTopic] 选择的话题: "${selectedTopic}"`);

  return selectedTopic;
};

// 对话类型检测
export const detectConversationType = (
  userMessage: string,
  conversationHistory: any[]
): 'simple' | 'normal' | 'detailed' | 'storytelling' => {
  const message = userMessage.toLowerCase();

  // 检测是否是请求详细信息的询问
  const detailRequests = [
    '讲讲',
    '说说',
    '介绍',
    '解释',
    '详细',
    '具体',
    '怎么样',
    '什么内容',
    '剧情',
    '故事',
    '过程',
    '经历',
    '发生了什么',
    '告诉我',
    '分享',
    '电影',
    '书',
    '游戏',
    '新闻',
    '事件',
  ];

  const storytellingKeywords = [
    '故事',
    '情节',
    '剧情',
    '内容',
    '讲述',
    '描述',
    '经过',
    '发生',
    '电影讲的',
    '书说的',
    '游戏剧情',
    '新闻内容',
  ];

  // 检查是否有上下文延续 (AI刚刚提到要搜索或要讲解)
  const lastAIMessage =
    conversationHistory.filter((msg) => msg.role === 'assistant').slice(-1)[0]
      ?.content || '';

  const hasContextContinuation =
    lastAIMessage.includes('搜索') ||
    lastAIMessage.includes('查一下') ||
    lastAIMessage.includes('了解') ||
    lastAIMessage.includes('想想');

  // 如果是故事讲述类请求
  if (storytellingKeywords.some((keyword) => message.includes(keyword))) {
    return 'storytelling';
  }

  // 如果是详细信息请求或有上下文延续
  if (
    detailRequests.some((keyword) => message.includes(keyword)) ||
    hasContextContinuation
  ) {
    return 'detailed';
  }

  // 简单的问候、确认、情感表达
  const simplePatterns = [
    /^(好|嗯|哦|是|对|没事|谢谢|再见|你好)$/,
    /^(哈哈|呵呵|嘿嘿|诶嘿嘿)$/,
    /^.{1,5}$/, // 5个字符以内的简短回应
  ];

  if (simplePatterns.some((pattern) => pattern.test(message))) {
    return 'simple';
  }

  return 'normal';
};

// 智能长度控制 - 根据对话类型调整 (Phase 2.1: 平衡简短和完整性)
export const getResponseLengthConfig = (
  conversationType: 'simple' | 'normal' | 'detailed' | 'storytelling'
) => {
  switch (conversationType) {
    case 'simple':
      return {
        maxTokens: CLAUDE_API_CONFIG.dynamicTokens.simple,
        maxCharacters: 50, // Phase 2.1: 15 -> 50 (允许完整句子，但通过Token控制简短)
        targetSentences: 1,
        allowMultiParagraph: false,
      };

    case 'normal':
      return {
        maxTokens: CLAUDE_API_CONFIG.dynamicTokens.normal,
        maxCharacters: 80, // Phase 2.1: 35 -> 80 (允许1-2个完整句子)
        targetSentences: 1,
        allowMultiParagraph: false,
      };

    case 'detailed':
      return {
        maxTokens: CLAUDE_API_CONFIG.dynamicTokens.detailed,
        maxCharacters: 150, // Phase 2.1: 80 -> 150
        targetSentences: 3,
        allowMultiParagraph: false,
      };

    case 'storytelling':
      return {
        maxTokens: CLAUDE_API_CONFIG.dynamicTokens.storytelling,
        maxCharacters: 250, // Phase 2.1: 150 -> 250
        targetSentences: 5,
        allowMultiParagraph: false,
      };

    default:
      return {
        maxTokens: CLAUDE_API_CONFIG.dynamicTokens.normal,
        maxCharacters: 80, // Phase 2.1: 35 -> 80
        targetSentences: 2,
        allowMultiParagraph: false,
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
