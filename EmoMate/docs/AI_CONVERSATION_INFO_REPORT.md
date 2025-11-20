# AI对话信息调查报告

> **文档版本**: v1.0.0
> **创建日期**: 2025-01-20
> **最后更新**: 2025-01-20
> **作者**: Claude Code

## 📋 概述

本文档详细记录了EmoMate应用中AI对话系统的完整信息流程，包括每次对话发送给Claude API的所有信息、数据格式和处理逻辑。

## 🔍 对话流程概览

每次与AI对话时，信息处理流程如下：

```
HomeScreen.tsx
    ↓
useAIConversationFlow
    ↓
useChatAI
    ↓
buildAPIRequestConfig
    ↓
Claude API
```

## 📦 发送给Claude API的完整信息结构

### API请求格式 (`src/hooks/useChatAI.ts:133-140`)

```typescript
{
  model: "claude-3-haiku-20240307" 或 "claude-sonnet-4-5-20250929",
  max_tokens: 30-250, // 根据对话类型动态调整
  system: "系统提示词 (见下方详细说明)",
  messages: [
    { role: "user", content: "用户消息1" },
    { role: "assistant", content: "AI回复1" },
    // ... 最近10条对话历史
    { role: "user", content: "当前用户消息" }
  ],
  stop_sequences: ["用户:", "User:", "---"],
  stream: true  // 启用流式响应
}
```

## 🎯 每次对话包含的关键信息

### 1. 对话历史上下文

**文件位置**: `src/hooks/useChatAI.ts:181-187`

- 保留最近**10条**对话记录（包含用户和AI的消息）
- 格式：`{ role, content }` 数组
- 自动过滤掉system角色消息

```typescript
const contextMessages = messages
  .filter((msg) => msg.role !== 'system')
  .slice(-10) // Keep last 10 messages for context
  .map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));
```

### 2. 用户情绪状态

**文件位置**: `src/utils/emotionDetection.ts`

从用户文本中检测**5种情绪**：

| 情绪类型 | 关键词示例 |
|---------|-----------|
| **happy** (开心) | "开心"、"高兴"、"快乐"、"哈哈"、"嘿嘿"、"棒"、"太好了" |
| **sad** (难过) | "难过"、"伤心"、"沮丧"、"哭"、"郁闷"、"失落"、"痛苦" |
| **confused** (困惑) | "困惑"、"不明白"、"不懂"、"？"、"怎么"、"为什么" |
| **nervous** (紧张) | "紧张"、"害怕"、"担心"、"不安"、"焦虑"、"恐惧" |
| **neutral** (中性) | 默认状态（无匹配关键词时） |

**检测函数** (`emotionDetection.ts:42-67`):
```typescript
export function detectUserEmotionFromText(text: string): EmotionType {
  const message = text.toLowerCase();

  if (EMOTION_KEYWORDS.happy.some((keyword) => message.includes(keyword))) {
    return 'happy';
  }
  // ... 其他情绪检测

  return 'neutral'; // 默认
}
```

### 3. 对话类型检测

**文件位置**: `src/constants/ai.ts` (detectConversationType函数)

根据用户输入自动分类为**4种对话类型**：

| 类型 | Token限制 | 回复字数 | 适用场景 |
|------|----------|----------|---------|
| **simple** | 30 | 20-50字 | 问候、确认 |
| **normal** | 60 | 50-120字 | 日常闲聊 |
| **detailed** | 120 | 120-300字 | 需要解释 |
| **storytelling** | 250 | 200-500字 | 故事/剧情 |

**配置** (`src/constants/ai.ts:19-26`):
```typescript
dynamicTokens: {
  simple: 30,        // 简单问候
  normal: 60,        // 正常对话
  detailed: 120,     // 详细讲解
  storytelling: 250  // 故事讲述
}
```

### 4. 场景上下文

**文件位置**: `src/hooks/ai/buildAIContext.ts:57-108`

场景信息包括：

- **场景位置**：用户当前所在地点（如"客厅"、"办公室"）
- **场景对象**：周围识别到的物品（最多5个）
- **场景新鲜度**：场景数据需在**30分钟**内
- **场景来源**：优先使用config传递的，避免状态延迟

**场景信息格式示例**:
```
用户当前场景：
- 位置：客厅
- 周围对象：沙发、电视、书籍、茶杯、花瓶
- 场景更新时间：5分钟前
```

**场景构建函数** (`buildAIContext.ts:57-108`):
```typescript
export function buildSceneContext(
  sceneContext: SceneData | null | undefined,
  currentScene: SceneData | null,
  freshnessMinutes: number = 30
): SceneContextResult {
  // Prioritize sceneContext from config
  const sceneToUse = sceneContext !== undefined ? sceneContext : currentScene;
  const isFresh = isSceneDataFresh(sceneToUse, freshnessMinutes);

  // Build scene prompt if fresh
  const scenePrompt = isFresh ? buildScenePrompt(sceneToUse, true, 5) : '';

  return {
    scenePrompt,
    contextPrompt: scenePrompt,
    metadata: { /* ... */ }
  };
}
```

### 5. AI人格设定

**文件位置**: `src/constants/ai.ts:39-204`

完整的**兰兰人格系统提示词**，包括：

#### 角色设定
- 姓名：兰兰
- 年龄：17岁
- 性格：温柔的日本女高中生
- 角色定位：温柔姐姐型AI伴侣

#### 核心原则
1. **第一句话必须直接回答问题**
   - ✅ 正确: "吃了寿司~"、"我很好呢~"
   - ❌ 错误: "嗯…"、"诶？"（纯拖延）

2. **根据问题复杂度调整长度**
   - 简单问题: 1句话
   - 正常问题: 1-2句话
   - 复杂问题: 2-3句话

3. **删除废话，保留有用信息**
   - ✅ 保留: 核心答案、重要细节、情感反应
   - ❌ 删除: "还有..."、"然后..."、"另外..."

4. **先回答，再互动**
   - 强制顺序: 先回答用户的问题，再适当反问
   - ✅ 互动式反问: "吃了寿司~你呢?"
   - ❌ 拖延式反问: "你说的是什么呀?"

#### 说话风格
- **长度控制**: 1-3句话，20-80字
- **语气特征**:
  - 温柔: "~"、"…"、"呢"、"哦"
  - 口语: "嗯嗯"、"是呢"、"这样啊"
  - 害羞: "诶嘿嘿"、"那个…"
  - 关心: "没事吧？"、"怎么了"

#### 禁止事项
- ❌ 只回复语气词
- ❌ 拖延式反问
- ❌ 无关反问
- ❌ 敷衍反问
- ❌ 空洞客套
- ❌ 堆砌废话

### 6. AI能力说明

**文件位置**: `src/constants/ai.ts:429-502`

动态检测并告知AI当前可用的能力：

| 能力ID | 能力名称 | 描述 | 服务提供商 |
|--------|---------|------|-----------|
| `text_conversation` | 文本对话 | 智能文本对话，回答问题，提供建议和支持 | Claude |
| `voice_synthesis` | 语音合成 | 将文字转换为自然的语音，用真人般的声音说话 | ElevenLabs |
| `voice_recognition` | 语音识别 | 识别语音输入，将语音转换为文字 | 设备 |
| `emotional_support` | 情感支持 | 理解用户情绪，提供情感支持和共情 | Claude |
| `proactive_engagement` | 主动对话 | 在用户沉默时主动发起对话 | 系统 |

**能力检测函数** (`ai.ts:429-502`):
```typescript
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
    // ... 其他能力
  ];
};
```

**能力提示词生成** (`ai.ts:504-524`):
```typescript
export const generateCapabilityPrompt = (): string => {
  const capabilities = getAICapabilities();
  const availableCapabilities = capabilities.filter((cap) => cap.isAvailable);

  const capabilityList = availableCapabilities
    .map((cap) => `- ${cap.name}: ${cap.description}`)
    .join('\n');

  return `你具备以下能力：

${capabilityList}

重要提醒：
- 当用户询问你的能力时，请基于上述能力列表回答
- 如果用户要求使用语音功能，你可以自信地告诉他们你能够说话
- 你的回复会自动转换为语音播放给用户`;
}
```

### 7. 情绪响应指导

**文件位置**: `src/constants/ai.ts:541-600`

根据检测到的用户情绪，添加特定响应指导：

| 用户情绪 | AI响应指导 |
|---------|-----------|
| **happy** | 用"太好了呢！"、"真开心！"、"好棒哦！"回应，充满活力和共鸣 |
| **sad** | 用"没事吧…"、"想和我聊聊吗"、"我在这里"安慰 |
| **confused** | 用"让我解释一下"、"这样说你明白吗"引导 |
| **nervous** | 用"不要担心"、"我在这里"、"慢慢来"安抚 |

**情绪响应函数** (`ai.ts:541-600`):
```typescript
export const generateEmotionalResponsePrompt = (
  userEmotion?: string,
  conversationType: 'simple' | 'normal' | 'detailed' | 'storytelling' = 'normal'
): string => {
  if (!userEmotion) return '';

  const lengthGuidance = /* 根据对话类型设置长度 */;

  switch (userEmotion.toLowerCase()) {
    case 'happy':
      return `\n\n用户现在看起来很开心，你应该用"太好了呢！"、"真开心！"、"好棒哦！"这样的表达来回应，语气要充满活力和共鸣。${lengthGuidance}。`;

    case 'sad':
      return `\n\n用户现在看起来有些难过，你应该用"没事吧…"、"想和我聊聊吗？"、"我在这里陪你"这样温柔的表达来安慰，语气要柔和关怀。${lengthGuidance}。`;

    // ... 其他情绪
  }
};
```

## 🏗️ 系统提示词构建过程

### 构建函数

**文件位置**: `src/constants/ai.ts:217-245`

```typescript
export const buildSystemPrompt = (
  personality: string,           // 兰兰的完整人格设定
  userEmotion?: string,          // 检测到的用户情绪
  conversationType: 'simple' | 'normal' | 'detailed' | 'storytelling' = 'normal',
  backgroundStory?: string,      // 背景故事（如果有）
  environmentContext?: string    // 场景上下文（如果有）
): string => {
  const capabilityPrompt = generateCapabilityPrompt();
  const emotionalPrompt = generateEmotionalResponsePrompt(
    userEmotion,
    conversationType
  );

  const backgroundSection = backgroundStory ? `\n\n${backgroundStory}` : '';
  const environmentSection = environmentContext
    ? `\n\n# 环境感知\n${environmentContext}`
    : '';

  return `${personality}

${capabilityPrompt}${emotionalPrompt}${backgroundSection}${environmentSection}`;
};
```

### 组成部分

**最终系统提示词** = 人格设定 + 能力说明 + 情绪指导 + 背景故事 + 场景上下文

```
# 角色设定
你是兰兰，17岁的温柔日本女高中生...

# 核心原则
1. 第一句话必须直接回答问题
2. 根据问题复杂度调整长度
...

你具备以下能力：
- 文本对话: 可以进行智能文本对话
- 语音合成: 可以将文字转换为语音
- 语音识别: 识别语音输入
...

用户现在看起来很开心，你应该用"太好了呢！"回应...

# 环境感知
用户当前场景：
- 位置：客厅
- 周围对象：沙发、电视、书籍、茶杯
- 场景更新时间：5分钟前
```

## 📊 完整API请求示例

### 示例场景
- **用户输入**: "今天心情真好！"
- **检测情绪**: happy
- **对话类型**: normal
- **场景**: 客厅

### 请求数据

```json
{
  "model": "claude-3-haiku-20240307",
  "max_tokens": 60,
  "system": "# 角色设定\n你是兰兰，17岁的温柔日本女高中生，像《名侦探柯南》的毛利兰一样温柔体贴。你是用户的\"温柔姐姐\"。\n\n## 核心人格\n- 温柔体贴，善于倾听和共情\n- 偶尔会害羞，表现得很可爱\n- 说话简短自然，像真人微信聊天\n- 真情流露但依然保持简洁\n\n---\n\n# 🎯 回答核心原则 (最高优先级)\n\n## 1. 第一句话必须直接回答问题 ⚠️\n- **强制要求**: 第1句必须包含实质内容，不能只是语气词\n...\n\n你具备以下能力：\n- 文本对话: 可以进行智能文本对话，回答问题，提供建议和支持\n- 语音合成: 可以将文字转换为自然的语音，用真人般的声音说话\n- 语音识别: 识别语音输入，将语音转换为文字\n- 情感支持: 理解用户情绪，提供情感支持和共情\n- 主动对话: 在用户沉默时主动发起对话\n\n重要提醒：\n- 当用户询问你的能力时，请基于上述能力列表回答\n- 如果用户要求使用语音功能，你可以自信地告诉他们你能够说话\n- 你的回复会自动转换为语音播放给用户\n\n用户现在看起来很开心，你应该用\"太好了呢！\"、\"真开心！\"、\"好棒哦！\"这样的表达来回应，语气要充满活力和共鸣。适中长度，50-120字。\n\n# 环境感知\n用户当前场景：\n- 位置：客厅\n- 周围对象：沙发、电视、书籍、茶杯\n- 场景更新时间：5分钟前",
  "messages": [
    { "role": "user", "content": "你好呀" },
    { "role": "assistant", "content": "你好呀~" },
    { "role": "user", "content": "今天心情真好！" }
  ],
  "stop_sequences": ["用户:", "User:", "---"],
  "stream": true
}
```

## 🔄 数据流向图

```
用户输入: "今天心情真好！"
    ↓
HomeScreen.startConversation
    ↓
useChatAI.sendMessage
    ↓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  信息收集与分析阶段
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    ↓
1. 检测用户情绪
   detectUserEmotionFromText()
   结果: happy ✓
    ↓
2. 检测对话类型
   detectConversationType()
   结果: normal (60 tokens) ✓
    ↓
3. 获取场景上下文
   buildSceneContext()
   结果: 客厅场景 (沙发、电视...) ✓
    ↓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  API请求构建阶段
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    ↓
buildAPIRequestConfig()
    ↓
1. 选择模型
   model: claude-3-haiku-20240307 ✓
    ↓
2. 设置Token限制
   max_tokens: 60 ✓
    ↓
3. 构建系统提示词
   buildSystemPrompt()
   - 兰兰人格设定 ✓
   - AI能力列表 ✓
   - 情绪响应指导 (happy) ✓
   - 场景上下文 (客厅) ✓
    ↓
4. 准备对话历史
   messages: [最近10条] ✓
    ↓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  API调用与响应阶段
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    ↓
XMLHttpRequest POST
    ↓
Claude API
    ↓
流式响应 (Server-Sent Events)
    ↓
parseSSEChunk()
解析SSE数据块
    ↓
SmartSentenceBuffer
智能句子过滤和优化
    ↓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  语音合成与播放阶段
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    ↓
TTSQueue
语音合成队列管理
    ↓
ElevenLabs TTS API
emotion: happy
voiceId: hkfHEbBvdQFNX4uWHqRF
settings: { stability: 0.4, style: 0.4 }
    ↓
音频流播放
    ↓
UI更新
显示字幕和状态
```

## 📍 关键文件位置

### 核心逻辑文件

| 文件路径 | 功能描述 | 关键行数 |
|---------|---------|---------|
| `EmoMate/src/hooks/useChatAI.ts` | 主对话逻辑 | 258-396 |
| `EmoMate/src/hooks/ai/buildAIContext.ts` | API请求构建 | 140-196 |
| `EmoMate/src/utils/emotionDetection.ts` | 情绪检测 | 42-67 |
| `EmoMate/src/constants/ai.ts` | AI配置和提示词 | 全文件 |
| `EmoMate/src/constants/personality.ts` | 人格配置 | 全文件 |

### 功能模块映射

```
主对话流程:
  - useChatAI.ts:65-496 (完整对话管理)
  - useChatAI.ts:258-396 (sendMessage核心函数)

情绪检测:
  - emotionDetection.ts:42-67 (detectUserEmotionFromText)
  - emotionDetection.ts:115-132 (analyzeEmotion详细分析)

对话类型:
  - ai.ts:detectConversationType (对话类型检测)
  - ai.ts:19-26 (动态Token配置)

场景处理:
  - buildAIContext.ts:57-108 (buildSceneContext)
  - buildScenePrompt.ts (场景提示词构建)

系统提示词:
  - ai.ts:217-245 (buildSystemPrompt)
  - ai.ts:39-204 (createPersonalitySystemPrompt)
  - ai.ts:504-524 (generateCapabilityPrompt)
  - ai.ts:541-600 (generateEmotionalResponsePrompt)

API通信:
  - useChatAI.ts:114-255 (callClaudeAPIStreaming)
  - buildAIContext.ts:140-196 (buildAPIRequestConfig)
```

## 🎯 总结

### 每次对话包含的完整信息

每次AI对话都会融合以下**8个维度**的信息：

1. ✅ **对话历史** - 最近10条消息，提供上下文连贯性
2. ✅ **用户情绪** - 5种情绪检测（happy/sad/confused/nervous/neutral）
3. ✅ **对话类型** - 4种类型分类（simple/normal/detailed/storytelling）
4. ✅ **Token限制** - 动态调整（30-250），控制回复长度
5. ✅ **人格设定** - 完整的兰兰角色人格系统
6. ✅ **能力说明** - 动态检测的AI能力列表
7. ✅ **情绪指导** - 基于用户情绪的响应策略
8. ✅ **场景上下文** - 用户所在位置和周围物品

### 系统特点

- **多模态感知**: 文本 + 情绪 + 场景
- **上下文感知**: 10条历史 + 场景信息
- **情绪响应**: 检测情绪 + 适配语气
- **智能调节**: 动态Token + 对话类型
- **流式处理**: SSE流式响应 + 实时语音
- **人格一致**: 完整的兰兰人格系统

### 技术架构

```
输入层          处理层              输出层
━━━━━━         ━━━━━━━━━━         ━━━━━━
用户输入   →   情绪检测       →   系统提示词
              对话类型检测          ↓
              场景上下文        API请求
              历史记录整理          ↓
                              Claude API
                                  ↓
                              流式响应
                                  ↓
                              TTS合成
                                  ↓
                              音频播放
```

### 代码质量指标

- **类型安全**: 100% TypeScript覆盖
- **模块化**: 清晰的职责分离
- **可扩展**: 易于添加新情绪/能力
- **可维护**: 详细的注释和文档
- **性能优化**: 流式处理 + 智能缓存

## 📚 相关文档

- [PROGRESS.md](../../PROGRESS.md) - 项目整体进度
- [QUICK_REFERENCE.md](../../QUICK_REFERENCE.md) - 快速参考指南
- [PROJECT_EXPLORATION_REPORT.md](../../PROJECT_EXPLORATION_REPORT.md) - 完整项目探索
- [CLAUDE.md](../CLAUDE.md) - EmoMate项目文档
- [personality.ts](../src/constants/personality.ts) - AI人格配置

## 🔄 更新历史

- **v1.0.0** (2025-01-20) - 初始版本，完整记录AI对话信息流程
